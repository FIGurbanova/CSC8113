# 1. run in local(Currently unavailable. New modifications have been made. It is only used for reference purposes regarding the steps.)
```bash
docker run -d --name bookstore-db \
  -e POSTGRES_PASSWORD=mysecretpassword \
  -e POSTGRES_DB=bookstore \
  -p 5432:5432 \
  postgres:15

docker exec -it bookstore-db psql -U postgres -d bookstore -c "
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  price DECIMAL(10,2) NOT NULL
);
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  items JSONB NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'CREATED',
  created_at TIMESTAMP DEFAULT NOW()
);"

docker exec -it bookstore-db psql -U postgres -d bookstore -c "
INSERT INTO products (name, price) VALUES
('The Phoenix Project', 29.99),
('Accelerate', 39.99),
('Team Topologies', 34.99);"
```

### Catalog Service
```bash
python -m venv venv
source venv/bin/activate  # Use venv\Scripts\activate on Windows
pip install -r requirements.txt
flask run --port=5001
```

### Cart Service
```bash
./gradlew clean bootRun

```

###  Front
```bash
npm start
```

### api test
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '[{"productId":1,"quantity":1}]' \
  http://localhost:8080/orders

curl http://localhost:5000/products


curl http://localhost:8080/orders/<order-id>
```
----
----
# All code（Currently unavailable. New modifications have been made. It is only used for reference purposes regarding the steps.）
### Step 1: Environment Setup 

```bash
 
# Install basic tools
# Docker Desktop: https://www.docker.com/products/docker-desktop
# Node.js 18.x: https://nodejs.org
# Python 3.10: https://www.python.org
# Java JDK 17: https://adoptium.net
# Verify installation
docker --version          # Docker 24.0+
node --version           # v18.16+
python --version         # 3.10+
java -version            # openjdk 17.0.8
#Create project directories
mkdir bookstore && cd bookstore
mkdir catalog-service cart-service frontend
Step 2: Database Configuration 
```
 ### Step 2:catalog service
 ```bash
# Enter the catalog service folder
cd catalog-service
# Create app.py
cat > app.py <<EOF
from flask import Flask, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS

app = Flask(__name__)
CORS(app)
app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://postgres:mysecretpassword@bookstore-db:5432/bookstore'
db = SQLAlchemy(app)

class Product(db.Model):
    __tablename__ = 'products'  # 显式指定表名
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    price = db.Column(db.Float, nullable=False)

@app.route('/products')
def get_products():
    products = Product.query.all()
    return jsonify([{
        "id": p.id,
        "name": p.name,
        "price": p.price
    } for p in products])

@app.route('/products/<int:product_id>')
def get_product(product_id):
    product = Product.query.get(product_id)
    if product:
        return jsonify({
            "id": product.id,
            "name": product.name,
            "price": product.price
        })
    return jsonify({"error": "Product not found"}), 404

if __name__ == '__main__':
    with app.app_context():
        # db.drop_all()  # 开发环境慎用此操作
        db.create_all()  # 仅创建不存在的表
        if not Product.query.first():
            # 插入多条测试数据
            db.session.add(Product(name="The Phoenix Project", price=29.99))
            # db.session.add(Product(name="Accelerate", price=39.99))
            # db.session.add(Product(name="Team Topologies", price=34.99))
            db.session.commit()
    app.run(host='0.0.0.0', port=5001)
EOF
```
```bash
#Create requirements.txt
echo "flask==3.0.0
flask-sqlalchemy==3.1.1
psycopg2-binary==2.9.7
flask-cors==4.0.0" > requirements.txt
# Start the service (keep the terminal running)
python -m venv venv
source venv/bin/activate  # Use venv\Scripts\activate on Windows
pip install -r requirements.txt
flask run --port=5001
```

### Step 3: Cart Service Implementation 

 ```bash
# Enter the cart service folder
cd../cart-service
# Initialize the Spring Boot project
curl https://start.spring.io/starter.zip \
  -d dependencies=web,postgresql \
  -d packageName=com.bookstore \
  -d name=CartService \
  -d javaVersion=17 \
  -d type=gradle-project \
  -o cart-service.zip
unzip cart-service.zip && rm cart-service.zip
# Add Order functionality code
mkdir -p src/main/java/com/bookstore
# Create CartItem.java
cat > src/main/java/com/bookstore/CartItem.java <<EOF
package com.bookstore;

import java.util.UUID;

// 修改 cart-service/src/main/java/com/bookstore/CartItem.java
public record CartItem(int productId, int quantity) { // 将 UUID 改为 int
    public CartItem {
        if (quantity <= 0) {
            throw new IllegalArgumentException("Quantity must be greater than 0");
        }
    }
}
EOF

# Create Order.java
cat > src/main/java/com/bookstore/Order.java <<EOF
package com.bookstore;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record Order(
    UUID id,
    List<CartItem> items,
    BigDecimal total,
    String status,
    Instant createdAt
) {
    public Order {
        if (id == null) {
            throw new IllegalArgumentException("ID cannot be null");
        }
        if (items == null || items.isEmpty()) {
            throw new IllegalArgumentException("Items cannot be null or empty");
        }
        if (total == null || total.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Total must be greater than 0");
        }
        if (status == null || status.isBlank()) {
            throw new IllegalArgumentException("Status cannot be null or blank");
        }
        if (createdAt == null) {
            throw new IllegalArgumentException("CreatedAt cannot be null");
        }
    }
}
EOF
# Create OrderController.java
cat > src/main/java/com/bookstore/OrderController.java <<EOF
package com.bookstore;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.util.List;
import java.util.UUID;
import java.math.BigDecimal;
import java.time.Instant;
import java.sql.Timestamp;

@RestController
@RequestMapping("/orders")
public class OrderController {

    private static final Logger logger = LoggerFactory.getLogger(OrderController.class);
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public OrderController(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @PostMapping
    public ResponseEntity<Order> createOrder(@RequestBody List<CartItem> items) {
        try {
            BigDecimal total = calculateTotal(items);
            UUID orderId = UUID.randomUUID();
            
            jdbcTemplate.update(
                "INSERT INTO orders (id, items, total, status, created_at) VALUES (?,?::jsonb,?,?,?)",
                orderId,
                objectMapper.writeValueAsString(items),
                total,
                "CREATED",
                Timestamp.from(Instant.now()) // 显式转换为 SQL 可识别的类型
            );

            return ResponseEntity.ok(new Order(
                orderId,
                items,
                total,
                "CREATED",
                Instant.now()
            ));
        } catch (JsonProcessingException e) {
            logger.error("Failed to process JSON", e);
            return ResponseEntity.badRequest().build();
        }
    }

    @GetMapping("/{orderId}")
    public ResponseEntity<Order> getOrder(@PathVariable UUID orderId) {
        return jdbcTemplate.query(
            "SELECT * FROM orders WHERE id =?",
            (rs, rowNum) -> {
                try {
                    return new Order(
                        orderId,
                        parseItems(rs.getString("items")),
                        rs.getBigDecimal("total"),
                        rs.getString("status"),
                        rs.getTimestamp("created_at").toInstant()
                    );
                } catch (JsonProcessingException e) {
                    logger.error("Failed to parse items", e);
                    return null; // 或者抛出自定义异常
                }
            },
            orderId
        ).stream().findFirst().map(ResponseEntity::ok)
        .orElse(ResponseEntity.notFound().build());
    }

    private BigDecimal calculateTotal(List<CartItem> items) {
        return BigDecimal.valueOf(items.size() * 39.99);
    }

    private List<CartItem> parseItems(String json) throws JsonProcessingException {
        return objectMapper.readValue(json, new TypeReference<>() {});
    }
}
EOF

cat > src/main/java/com/bookstore/CorsConfig.java <<EOF
package com.bookstore;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class CorsConfig {

    @Bean
    public WebMvcConfigurer corsConfigurer() {
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(CorsRegistry registry) {
                registry.addMapping("/**")
                        .allowedOrigins(
                            "http://localhost",
                            "http://frontend",
                            "http://35.176.187.132",
                            "http://35.176.187.132:80"  // 显式添加端口
                        )
                        .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                        .allowedHeaders("*")
                        .exposedHeaders("Authorization")  // 暴露自定义头
                        .allowCredentials(true)
                        .maxAge(3600);
            }
        };
    }
}
EOF

cat > src/main/java/com/bookstore/CatalogServiceClient.java <<EOF
package com.bookstore;

import java.math.BigDecimal; // 关键导入
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

@Component
public class CatalogServiceClient {
    private final RestTemplate restTemplate = new RestTemplate();

    public BigDecimal getProductPrice(int productId) {
        String url = "http://catalog-service:5001/products/" + productId;
        Product product = restTemplate.getForObject(url, Product.class);
        return BigDecimal.valueOf(product.price());
    }

    // 内部记录类型必须与返回的JSON结构匹配
    private record Product(int id, String name, double price) {}
}
EOF
# Configure database connection
echo "spring.datasource.url=jdbc:postgresql://bookstore-db:5432/bookstore
spring.datasource.username=postgres
spring.datasource.password=mysecretpassword
spring.jpa.hibernate.ddl-auto=none" > src/main/resources/application.properties
# 4. Start the service (keep the terminal running)
./gradlew clean bootRun
 ```

### Step 5: Front - end Implementation 

 ```bash
# Enter the front - end folder
cd../frontend
# 1. Initialize the React project
npx create-react-app my-app --template typescript
npm install axios @mui/material @emotion/react @emotion/styled
# 2. Replace App.tsx
cat > src/App.tsx <<EOF
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button, TextField, Container, Grid, Paper, Typography } from '@mui/material';

interface Product {
  id: number;
  name: string;
  price: number;
}

interface CartItem {
  productId: number;
  quantity: number;
}

interface Order {
  id: string;
  items: CartItem[];
  total: number;
  status: string;
  createdAt: string;
}

function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [order, setOrder] = useState<Order | null>(null);
  const [orderId, setOrderId] = useState('');

  // 使用环境变量定义 API 地址
  const CATALOG_API = process.env.REACT_APP_API_BASE_URL ; // || 'http://localhost:5001'
  const ORDER_API = process.env.REACT_APP_ORDER_SERVICE_URL ;// || 'http://localhost:8080'

  useEffect(() => {
    axios.get(`${CATALOG_API}/products`)
     .then(res => setProducts(res.data))
     .catch(console.error);
  }, [CATALOG_API]);

  const addToCart = (productId: number) => {
    const newItem = { productId, quantity: 1 };
    setCart([...cart, newItem]);
  };

  const checkout = () => {
    axios.post(`${ORDER_API}/orders`, 
        cart.map(item => ({
            productId: item.productId, 
            quantity: item.quantity
        }))
    )
    .then(res => {
        setOrder(res.data);
        setCart([]);
    })
    .catch(error => console.error('Checkout Error:', error));
  };

  const searchOrder = () => {
    axios.get(`${ORDER_API}/orders/${orderId}`)
     .then(res => setOrder(res.data));
  };

  return (
    <Container maxWidth="lg" sx={{ padding: 4 }}>
      <Typography variant="h3" gutterBottom>Bookstore</Typography>
      
      <Grid container spacing={4}>
        <Grid item xs={8}>
          <Paper sx={{ padding: 3 }}>
            <Typography variant="h5">Products</Typography>
            {products.map(product => (
              <div key={product.id} style={{ margin: '16px 0' }}>
                <Typography variant="body1">
                  {product.name} - ${product.price}
                </Typography>
                <Button 
                  variant="contained" 
                  size="small"
                  onClick={() => addToCart(product.id)}
                >
                  Add to Cart
                </Button>
              </div>
            ))}
          </Paper>
        </Grid>

        <Grid item xs={4}>
          <Paper sx={{ padding: 3 }}>
            <Typography variant="h5">Cart ({cart.length})</Typography>
            {cart.map((item, index) => (
              <div key={index}>
                Product #{item.productId} x {item.quantity}
              </div>
            ))}
            <Button 
              variant="contained" 
              color="success" 
              fullWidth
              disabled={cart.length === 0}
              onClick={checkout}
              sx={{ mt: 2 }}
            >
              Checkout (${cart.length * 39.99})
            </Button>
          </Paper>

          <Paper sx={{ padding: 3, mt: 3 }}>
            <Typography variant="h5">Order Lookup</Typography>
            <TextField
              label="Order ID"
              variant="outlined"
              fullWidth
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              sx={{ mt: 2 }}
            />
            <Button 
              variant="outlined" 
              fullWidth
              onClick={searchOrder}
              sx={{ mt: 1 }}
            >
              Search Order
            </Button>
            
            {order && (
              <div style={{ marginTop: 16 }}>
                <Typography>Order ID: {order.id}</Typography>
                <Typography>Total: ${order.total}</Typography>
                <Typography>Status: {order.status}</Typography>
              </div>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}

export default App;
EOF
# 3. Start the front - end
npm start
```

# 2. run in local docker
```bash
docker network create bookstore-network

docker run -d --name bookstore-db \
  --network bookstore-network \
  -e POSTGRES_PASSWORD=mysecretpassword \
  -e POSTGRES_DB=bookstore \
  -p 5432:5432 \
  postgres:15

docker exec -it bookstore-db psql -U postgres -d bookstore -c "
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  price DECIMAL(10,2) NOT NULL
);"
docker exec -it bookstore-db psql -U postgres -d bookstore -c "
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  items JSONB NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'CREATED',
  created_at TIMESTAMP DEFAULT NOW()
);"

docker exec -it bookstore-db psql -U postgres -d bookstore -c "
INSERT INTO products (name, price) VALUES
('The Phoenix Project', 29.99),
('Accelerate', 39.99),
('Team Topologies', 34.99);"


docker build -t catalog-service:1.0 -f catalog-service/Dockerfile ./catalog-service
docker build -t cart-service:1.0 -f cart-service/Dockerfile ./cart-service

docker build --build-arg REACT_APP_API_BASE_URL=http://localhost:5001 --build-arg REACT_APP_ORDER_SERVICE_URL=http://localhost:8080 -t frontend:1.0 -f frontend/Dockerfile ./frontend/my-app



docker run -d \
  --name catalog-service \
  --network bookstore-network \
  -p 5001:5001 \
  catalog-service:1.0


docker run -d \
  --name cart-service \
  --network bookstore-network \
  -p 8080:8080 \
  cart-service:1.0


  docker run -d \
  --name frontend \
  --network bookstore-network \
  -p 80:80 \
  frontend:1.0
  ```

  # 3.run in EC2 docker（Currently unavailable. New modifications have been made. It is only used for reference purposes regarding the steps.）
```bash
  # 构建并推送 Catalog Service
docker build --platform linux/amd64 -t 054037139574.dkr.ecr.eu-west-2.amazonaws.com/catalog-service:1.0 ./catalog-service

docker push 054037139574.dkr.ecr.eu-west-2.amazonaws.com/catalog-service:1.0

# 构建并推送 Cart Service
docker build --platform linux/amd64 -t 054037139574.dkr.ecr.eu-west-2.amazonaws.com/cart-service:1.0 ./cart-service

docker push 054037139574.dkr.ecr.eu-west-2.amazonaws.com/cart-service:1.0

# 构建并推送 Frontend
docker build --platform linux/amd64 \
  -t 054037139574.dkr.ecr.eu-west-2.amazonaws.com/frontend:1.0 \
  -f frontend/Dockerfile \
  --build-arg REACT_APP_API_BASE_URL=http://35.176.187.132:5001 \
  --build-arg REACT_APP_ORDER_SERVICE_URL=http://35.176.187.132:8080 \
  ./frontend/my-app

docker push 054037139574.dkr.ecr.eu-west-2.amazonaws.com/frontend:1.0
```
### docker-compose.yml
```bash
nano docker-compose.yml

version: '3.8'

services:
  bookstore-db:
    image: postgres:15
    container_name: bookstore-db
    environment:
      POSTGRES_PASSWORD: mysecretpassword
      POSTGRES_DB: bookstore
    networks:
      - bookstore-network
    ports:
      - "5432:5432"
    volumes:
      - /mnt/postgresql/data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  catalog-service:
    image: 054037139574.dkr.ecr.eu-west-2.amazonaws.com/catalog-service:1.0
    networks:
      - bookstore-network
    ports:
      - "5001:5001"
    depends_on:
      bookstore-db:
        condition: service_healthy

  cart-service:
    image: 054037139574.dkr.ecr.eu-west-2.amazonaws.com/cart-service:1.0
    networks:
      - bookstore-network
    ports:
      - "8080:8080"
    depends_on:
      bookstore-db:
        condition: service_healthy

  frontend:
    image: 054037139574.dkr.ecr.eu-west-2.amazonaws.com/frontend:1.0
    networks:
      - bookstore-network
    ports:
      - "80:80"
    depends_on:
      bookstore-db:
        condition: service_healthy

  frontend:
    image: 054037139574.dkr.ecr.eu-west-2.amazonaws.com/frontend:1.0
    networks:
      - bookstore-network
    ports:
      - "80:80"
    depends_on:
      - catalog-service
      - cart-service

networks:
  bookstore-network:
    driver: bridge
```

```bash
docker-compose up -d
```
### helpful line
```bash
### AWS
aws ecr get-login-password --region eu-west-2 | \
docker login --username AWS --password-stdin 054037139574.dkr.ecr.eu-west-2.amazonaws.com


aws configure

AWS Access Key ID: [your Access Key]
AWS Secret Access Key: [your Secret Key]
Default region name: eu-west-2
Default output format: json

aws ecr create-repository --repository-name catalog-service --region eu-west-2
aws ecr create-repository --repository-name cart-service --region eu-west-2
aws ecr create-repository --repository-name frontend --region eu-west-2

ssh -i your-key.pem ec2-user@<EC2-Public-IP>


### docker
docker rmi 054037139574.dkr.ecr.eu-west-2.amazonaws.com/cart-service:1.0

docker-compose down -v

 sudo ls -l /mnt/postgresql/data

 docker exec -it bookstore-db   psql -U postgres -d bookstore -c "\dt"

 docker exec -it bookstore-db \
  psql -U postgres -d bookstore -c "\x" -c "SELECT id, total, status, to_char(created_at, 'YYYY-MM-DD HH24:MI') AS created_time, items FROM orders;"
```


# 4. EKS（2025.3.10-version）
```bash
eksctl version
kubectl version --client
aws configure
```
1. Create EKS cluster role 
In the IAM console, create a role and select "EKS" > "EKS-Cluster" use case.
Attach the policy AmazonEKSClusterPolicy.
2. Create a node group role 
Create a role and select the "EC2" use case.
Additional policies: AmazonEKSWorkerNodePolicy
AmazonEC2ContainerRegistryReadOnly
AmazonEKS_CNI_Policy
AmazonEBSCSIDriverPolicy

```bash
aws iam get-role --role-name EKS-Cluster-Role --query 'Role.Arn' --output text
# example：arn:aws:iam::123456789012:role/EKS-Cluster-Role
aws iam get-role --role-name EKS-NodeGroup-Role --query 'Role.Arn' --output text
# example：arn:aws:iam::123456789012:role/EKS-NodeGroup-Role
```

```bash
nano cluster.yaml

apiVersion: eksctl.io/v1alpha5
kind: ClusterConfig

metadata:
  name: bookstore-cluster
  region: eu-west-2
  version: "1.28"

iam:
  serviceRoleARN: "arn:aws:iam::054037139574:role/EKS-Cluster-Role"

managedNodeGroups:
  - name: ng-1
    instanceType: t3.medium
    minSize: 2
    maxSize: 5
    desiredCapacity: 2
    ssh:
      allow: true
      publicKeyName: CSC81113  
    iam:
      instanceRoleARN: "arn:aws:iam::054037139574:role/EKS-NodeGroup-Role"

```
```bash
eksctl create cluster -f cluster.yaml
### wait 10-20 mins
```

```bash
eksctl utils associate-iam-oidc-provider \
  --cluster bookstore-cluster \
  --region eu-west-2 \
  --approve

eksctl create addon \
  --name aws-ebs-csi-driver \
  --cluster bookstore-cluster \
  --region eu-west-2 \
  --force

kubectl get pods -n kube-system | grep ebs-csi
# example：
# ebs-csi-controller-xxxxx   6/6     Running   0          2m
# ebs-csi-node-xxxxx         3/3     Running   0          2m

kubectl get pvc  # STATUS=Bound
kubectl get pods  


### help to delete, dont use it
kubectl delete -f postgres-statefulset.yaml
kubectl delete pvc postgres-data-postgres-0
```
### kubectl apply -f
```bash
nano postgres-statefulset.yaml

apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: bookstore-db
spec:
  serviceName: "bookstore-db"  # 关键修改点
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
        - name: postgres
          image: postgres:15
          env:
            - name: POSTGRES_PASSWORD
              value: "mysecretpassword"
            - name: POSTGRES_DB
              value: "bookstore"
            - name: PGDATA
              value: /var/lib/postgresql/data/pgdata
          ports:
            - containerPort: 5432
          volumeMounts:
            - name: postgres-data
              mountPath: /var/lib/postgresql/data
  volumeClaimTemplates:
    - metadata:
        name: postgres-data
      spec:
        accessModes: [ "ReadWriteOnce" ]
        storageClassName: "gp2" 
        resources:
          requests:
            storage: 8Gi
---
apiVersion: v1
kind: Service
metadata:
  name: bookstore-db  
spec:
  selector:
    app: postgres
  ports:
    - protocol: TCP
      port: 5432
      targetPort: 5432
  type: ClusterIP

```

``` bash
nano catalog-service.yaml

apiVersion: apps/v1
kind: Deployment
metadata:
  name: catalog-service
spec:
  replicas: 2
  selector:
    matchLabels:
      app: catalog-service
  template:
    metadata:
      labels:
        app: catalog-service
    spec:
      containers:
        - name: catalog-service
          image: 054037139574.dkr.ecr.eu-west-2.amazonaws.com/catalog-service:1.0
          imagePullPolicy: Always
          ports:
            - containerPort: 5001
          env:
            - name: SQLALCHEMY_DATABASE_URI
              value: "postgresql://postgres:mysecretpassword@postgres:5432/bookstore"
          resources:
            requests:
              cpu: 200m
              memory: 256Mi
            limits:
              cpu: 500m
              memory: 512Mi
---
apiVersion: v1
kind: Service
metadata:
  name: catalog-service
spec:
  selector:
    app: catalog-service
  ports:
    - protocol: TCP
      port: 5001
      targetPort: 5001
  type: LoadBalancer  # 对外暴露服务

```
```bash
nano cart-service.yaml

apiVersion: apps/v1
kind: Deployment
metadata:
  name: cart-service
spec:
  replicas: 2
  selector:
    matchLabels:
      app: cart-service
  template:
    metadata:
      labels:
        app: cart-service
    spec:
      containers:
        - name: cart-service
          image: 054037139574.dkr.ecr.eu-west-2.amazonaws.com/cart-service:2.0
          imagePullPolicy: Always
          ports:
            - containerPort: 8080
          env:
            - name: SPRING_DATASOURCE_URL
              value: "jdbc:postgresql://bookstore-db:5432/bookstore"  # 修正数据库服务名
          resources:
            requests:
              cpu: 200m
              memory: 256Mi
            limits:
              cpu: 500m
              memory: 512Mi
---
apiVersion: v1
kind: Service
metadata:
  name: cart-service
spec:
  selector:
    app: cart-service
  ports:
    - protocol: TCP
      port: 8080
      targetPort: 8080
  type: LoadBalancer  
```
``` bash
nano frontend-service.yaml

apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
spec:
  replicas: 2
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
    spec:
      containers:
        - name: frontend
          image: 054037139574.dkr.ecr.eu-west-2.amazonaws.com/frontend:4.0
          imagePullPolicy: Always
          ports:
            - containerPort: 80
---
apiVersion: v1
kind: Service
metadata:
  name: frontend
spec:
  selector:
    app: frontend
  ports:
    - protocol: TCP
      port: 80
      targetPort: 80
  type: LoadBalancer  # 对外暴露
```
### new file Nginx in frontend
```bash
nano nginx.conf
# frontend/my-app/nginx.conf
server {
    listen 80;
    server_name localhost;

    # 根目录指向 React 构建后的静态文件
    root /usr/share/nginx/html;
    index index.html;

    # 处理静态资源请求
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 代理到 Catalog Service（路径重写）
    location /api/products {
        rewrite ^/api(/.*) $1 break;  # 去除 /api 前缀
        proxy_pass http://catalog-service:5001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # 代理到 Cart Service（路径重写）
    location /api/orders {
        rewrite ^/api(/.*) $1 break;  # 去除 /api 前缀
        proxy_pass http://cart-service:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

```
### helpful line
```bash
kubectl get pods
kubectl get svc frontend

kubectl exec -it bookstore-db-0 -- psql -U postgres -d bookstore
\dt

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  price DECIMAL(10,2) NOT NULL
);

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  items JSONB NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'CREATED',
  created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO products (name, price) VALUES
('The Phoenix Project', 29.99),
('Accelerate', 39.99),
('Team Topologies', 34.99);

SELECT * FROM products;
SELECT * FROM orders;

\dt
```

```bash
### care about version
  # Catalog Service
docker build --platform linux/amd64 -t 054037139574.dkr.ecr.eu-west-2.amazonaws.com/catalog-service:1.0 ./catalog-service

docker push 054037139574.dkr.ecr.eu-west-2.amazonaws.com/catalog-service:1.0

# Cart Service
docker build --platform linux/amd64 -t 054037139574.dkr.ecr.eu-west-2.amazonaws.com/cart-service:2.0 ./cart-service

docker push 054037139574.dkr.ecr.eu-west-2.amazonaws.com/cart-service:2.0

# frontend
docker build --platform linux/amd64 \
  -t 054037139574.dkr.ecr.eu-west-2.amazonaws.com/frontend:4.0 \
  -f frontend/Dockerfile \
  --build-arg REACT_APP_API_BASE_URL=http://catalog-service:5001 \
  --build-arg REACT_APP_ORDER_SERVICE_URL=http://cart-service:8080 \
  ./frontend/my-app

docker push 054037139574.dkr.ecr.eu-west-2.amazonaws.com/frontend:4.0
```

```bash
cd CSC8113

git add .

git commit -m "move to GCP"

git push origin main
```

# 5. GCP
```bash
gcloud services enable \
  container.googleapis.com \
  artifactregistry.googleapis.com \
  compute.googleapis.com


gcloud artifacts repositories create bookstore-repo \
  --repository-format=docker \
  --location=europe-west2 \
  --description="Bookstore Docker repository"

# 认证 Docker 客户端
gcloud auth configure-docker europe-west2-docker.pkg.dev

# 验证配置
cat ~/.docker/config.json | grep "europe-west2-docker.pkg.dev"



# Catalog Service
docker tag 054037139574.dkr.ecr.eu-west-2.amazonaws.com/catalog-service:1.0 \
  europe-west2-docker.pkg.dev/csc8113/bookstore-repo/catalog-service:1.0

# Cart Service
docker tag 054037139574.dkr.ecr.eu-west-2.amazonaws.com/cart-service:2.0 \
  europe-west2-docker.pkg.dev/csc8113/bookstore-repo/cart-service:2.0

# Frontend
docker tag 054037139574.dkr.ecr.eu-west-2.amazonaws.com/frontend:4.0 \
  europe-west2-docker.pkg.dev/csc8113/bookstore-repo/frontend:4.0


docker push europe-west2-docker.pkg.dev/csc8113/bookstore-repo/catalog-service:1.0
docker push europe-west2-docker.pkg.dev/csc8113/bookstore-repo/cart-service:2.0
docker push europe-west2-docker.pkg.dev/csc8113/bookstore-repo/frontend:4.0


gcloud container clusters create bookstore-gke \
  --region=europe-west2 \
  --machine-type=e2-small \
  --num-nodes=1 \
  --enable-autoscaling \
  --min-nodes=1 \
  --max-nodes=3 \
  --disk-type=pd-standard \
  --disk-size=50 \
  --enable-ip-alias \
  --workload-pool=csc8113.svc.id.goog \
  --tags=bookstore-cluster


gcloud container clusters get-credentials bookstore-gke --region=europe-west2


# 创建 Google 服务账号
gcloud iam service-accounts create gke-workload-identity \
  --display-name="GKE Workload Identity"

# 绑定 Kubernetes 服务账号
gcloud iam service-accounts add-iam-policy-binding \
  --role roles/iam.workloadIdentityUser \
  --member "serviceAccount:YOUR_PROJECT_ID.svc.id.goog[default/default]" \
  gke-workload-identity@YOUR_PROJECT_ID.iam.gserviceaccount.com

# 创建 Kubernetes 服务账号
kubectl create serviceaccount gke-postgres-sa
kubectl annotate serviceaccount gke-postgres-sa \
  iam.gke.io/gcp-service-account=gke-workload-identity@YOUR_PROJECT_ID.iam.gserviceaccount.com

kubectl create secret generic postgres-secret \
  --from-literal=password=mysecretpassword \
  --from-literal=username=postgres


kubectl apply -f postgres-statefulset-gke.yaml
kubectl apply -f catalog-service-gke.yaml
kubectl apply -f cart-service-gke.yaml
kubectl apply -f frontend-service-gke.yaml

# 查看部署状态
watch kubectl get pods,svc,pvc
```


# 5.PostgreSQL Backup & Restore Using Velero in Google Kubernetes Engine (GKE)
## **🚀 Prerequisites**
Ensure you have:
- **Google Cloud SDK (gcloud CLI)** installed
- **Velero CLI** installed (`brew install velero` for Mac)
- **A running PostgreSQL instance** in Kubernetes

---
## ** Step 1: Install Velero Locally**
```sh
##Velero is a backup and restore tool for Kubernetes.
brew install velero  # For Mac/Linux
```
##Step 2: Set Up Google Cloud Storage (GCS) as Backup Location
Velero stores backups in a GCS bucket.
```sh
##2.1 Create a GCS Bucket for Backups

export BUCKET_NAME=csc8113-postgres-backups
export PROJECT_ID=csc8113-453518 ## write your project_id

gcloud storage buckets create $BUCKET_NAME --location=europe-west2 --project=$PROJECT_ID

##2.2 Create a Service Account for Velero

gcloud iam service-accounts create velero \
    --display-name "Velero Backup Service Account"

##2.3 Grant IAM Permissions to Velero

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member serviceAccount:velero@$PROJECT_ID.iam.gserviceaccount.com \
    --role roles/storage.admin

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member=serviceAccount:velero@$PROJECT_ID.iam.gserviceaccount.com \
    --role=roles/compute.storageAdmin

##2.4 Generate and Download Velero Credentials

gcloud iam service-accounts keys create credentials-velero.json \
    --iam-account velero@$PROJECT_ID.iam.gserviceaccount.com

```

##Step 3: Deploy Velero in GKE
```bash
3.1 Check if Storage Supports Snapshots

kubectl get pvc -n default

##✅ If STORAGECLASS is standard-rwo, you can use Velero snapshots.

##3.2 Install Velero with GCP Plugin

velero install \
    --provider gcp \
    --plugins velero/velero-plugin-for-gcp:v1.6.0 \
    --bucket csc8113-postgres-backups \
    --secret-file ./credentials-velero.json \
    --backup-location-config serviceAccount=velero@$PROJECT_ID.iam.gserviceaccount.com

##3.3 Annotate PostgreSQL PVC for Snapshots

kubectl annotate pvc postgres-data-bookstore-db-0 backup.velero.io/backup-volumes=true

##Verify annotation:

kubectl get pvc postgres-data-bookstore-db-0 -o yaml | grep "backup.velero.io"
```
##Step 4: Schedule Automated Daily Backups
```bash
velero schedule create daily-db-backup \
    --schedule "0 2 * * *" \
    --include-namespaces default \
    --snapshot-volumes=true \
    --ttl 168h

##This creates daily backups at 2 AM, retained for 7 days.

##4.1 Verify Scheduled Backups

velero get schedules
```
##Step 5: Restore a PostgreSQL Backup
``` bash
##5.1 Restore the Latest Backup

velero restore create --from-backup daily-db-backup

##5.2 Restore a Specific Backup

velero restore create --from-backup backup-2024-03-12

##5.3 Check Restore Status

velero get backups
```

#Testing PostgreSQL Backups

##Step 1: Simulate Data Loss (Delete PostgreSQL Pod & PVC)
```bash
##Since PostgreSQL is in a StatefulSet, deleting just the pod will trigger an automatic restart.
##So, first scale down the StatefulSet and then delete the PVC.
##
##1.1 Scale Down StatefulSet (Prevent Auto-Restart)
kubectl scale statefulset bookstore-db --replicas=0 -n default

##1.2 Delete the PVC (Simulate Data Loss)
kubectl delete pvc postgres-data-bookstore-db-0 -n default
```
##Step 2: Restore PostgreSQL from Backup
```bash
velero restore create --from-backup test-postgres-backup

##Check restore status: (It should be Completed status)
velero restore get    
```
##Step 3: Verify PostgreSQL is Running & Data is Restored
```bash
##3.1 Scale StatefulSet Back Up
kubectl scale statefulset bookstore-db --replicas=1 -n default

##3.2 Check If the PostgreSQL Pod is Running
kubectl get pods -n default

##3.3 Connect to PostgreSQL & Verify Data
kubectl exec -it bookstore-db-0 -- psql -U postgres -d bookstore
```

# 6.CI/CD

```bash
# 创建服务账号并授权
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions CI/CD" \
  --project=csc8113

# 赋予 Artifact Registry 写入权限
gcloud projects add-iam-policy-binding csc8113 \
  --member="serviceAccount:github-actions@csc8113.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding csc8113 \
  --member="serviceAccount:github-actions@csc8113.iam.gserviceaccount.com" \
  --role="roles/container.clusterViewer"

gcloud projects add-iam-policy-binding csc8113 \
  --member="serviceAccount:github-actions@csc8113.iam.gserviceaccount.com" \
  --role="roles/compute.viewer"


# 生成服务账号密钥文件
gcloud iam service-accounts keys create gcp-sa-key.json \
  --iam-account=github-actions@csc8113.iam.gserviceaccount.com


gcloud iam service-accounts list \
  --project=csc8113 \
  --format="value(email)"

kubectl apply -f rbac-config.yaml
```
```bash
Configure Google Cloud IAM permissions (web operation)
Objective: Grant the Kubernetes Engine Developer and Artifact Registry Writer roles to the service account.
Enter the IAM management page: 
Open the GCP console. 
Navigate to IAM & Admin > IAM. 
Search for service account: 
Search for your service account (such as github-actions@csc8113.iam.gserviceaccount.com) in the member list. 
Add a character: 
Click on the "Edit" icon (the pencil icon) at the end of the service account row. 
Click "Add Other Characters". 
Add the following roles in sequence: 
Kubernetes Engine > Kubernetes Engine Developer

Artifact Registry > Artifact Registry Writer

Click "Save".
```
### Configure GitHub Secrets
```bash
Go to the Settings > Secrets and variables > Actions section of the GitHub repository. 
Add the following Secrets: 
GCP_PROJECT_ID: csc8113
GCP_SA_KEY: Paste the content of the file "gcp-sa-key.json" here. 
GCR_REGISTRY: europe-west2-docker.pkg.dev/csc8113/bookstore-repo
GKE_CLUSTER_NAME: bookstore-cluster
GKE_ZONE: europe-west2
```
### go to github action and run


# 7.Deploy Prometheus + Grafana on GCP Compute Engine
``` bash
##Step 1: Create a GCP VM Instance

##Use Google Compute Engine to create a VM:

gcloud compute instances create monitoring-vm \
    --machine-type=f1-micro \
    --image-family=debian-11 \
    --image-project=debian-cloud \
    --zone=europe-west2-c \
    --tags=http-server
    
##✅ This VM will host Prometheus, Grafana, and Node Exporter. If europe-west2-c resource is not enough use other zones (a,b)

```
``` bash
##Step 2: Install Prometheus
##SSH into the instance:

gcloud compute ssh monitoring-vm --zone= europe-west2-c
```

```bash
##Step 3: Configure Prometheus
##Edit the configuration file:

sudo nano /etc/prometheus/prometheus.yml
##Add this configuration:

global:
  scrape_interval: 30s  # Reduce frequency to save resources

scrape_configs:
  - job_name: 'node_exporter'
    static_configs:
      - targets: ['localhost:9100']

```
```bash
##Step 4: Start Prometheus Service

# Create a systemd service
sudo tee /etc/systemd/system/prometheus.service <<EOF
[Unit]
Description=Prometheus
Wants=network-online.target
After=network-online.target

[Service]
User=root
ExecStart=/usr/local/bin/prometheus --config.file=/etc/prometheus/prometheus.yml --storage.tsdb.path=/var/lib/prometheus
Restart=always

[Install]
WantedBy=multi-user.target
EOF

```
``` bash
# Start and enable Prometheus
sudo systemctl daemon-reload
sudo systemctl enable prometheus
sudo systemctl start prometheus

##✅ Prometheus should now be running on http://<VM-IP>:9090
```

```bash
##Find VM's External IP Address (GCP)
##Using gcloud CLI
##Run this command in your terminal:

gcloud compute instances list --format="table(name,EXTERNAL_IP)"

```
```bash
##Install Node Exporter (System Metrics Collection)

# Download Node Exporter
wget https://github.com/prometheus/node_exporter/releases/download/v1.7.0/node_exporter-1.7.0.linux-amd64.tar.gz
tar xvf node_exporter-*.tar.gz
cd node_exporter-*

# Move binary to /usr/local/bin
sudo mv node_exporter /usr/local/bin/

# Create a systemd service
sudo tee /etc/systemd/system/node_exporter.service <<EOF
[Unit]
Description=Node Exporter
After=network.target

[Service]
User=root
ExecStart=/usr/local/bin/node_exporter
Restart=always

[Install]
WantedBy=multi-user.target
EOF

```
```bash
# Start Node Exporter
sudo systemctl daemon-reload
sudo systemctl enable node_exporter
sudo systemctl start node_exporter
#✅ Node Exporter should now be running on http://<VM-IP>:9100/metrics

```
```bash
#Install Grafana

# Add Grafana repository
sudo apt-get install -y software-properties-common
sudo add-apt-repository "deb https://packages.grafana.com/oss/deb stable main"
wget -q -O - https://packages.grafana.com/gpg.key | sudo apt-key add -

# Install Grafana
sudo apt update
sudo apt install -y grafana

# Start and enable Grafana
sudo systemctl enable grafana-server
sudo systemctl start grafana-server

Grafana should now be running on http://<VM-IP>:3000
•    Default login: admin / admin

```

```bash
If Grafana is not accessible at http://<VM-IP>:3000, follow these steps to fix it.

Step 1. Check if Grafana is Running
SSH into your VM:
gcloud compute ssh free-monitoring-vm --zone=europe-west2-a

Run the following command to check Grafana's status:
sudo systemctl status grafana-server

✔ If running → Move to Step 2.
❌ If not running, restart it:
sudo systemctl restart grafana-server
sudo systemctl enable grafana-server
Check logs for errors:
sudo journalctl -u grafana-server --no-pager | tail -20
```

```bash
##Step2. Allow Traffic on Port 3000
##By default, Google Cloud blocks ports other than 80 (HTTP) and 443 (HTTPS). You need to create a ##firewall rule to allow Grafana access on port 3000.
##Check if a firewall rule exists

gcloud compute firewall-rules list --filter="name:grafana-allow"

##👉 If no rule exists, create one:

gcloud compute firewall-rules create grafana-allow \
    --allow=tcp:3000 \
    --target-tags=http-server \
    --description="Allow Grafana access on port 3000" \
    --direction=INGRESS \
    --priority=1000 \
    --network=default
    
##✅ This allows public access to Grafana.

```

```bash
##When adding data source: 

URL: http://localhost:9090. returns Post "http://localhost:9090/api/v1/query": dial tcp [::1]:9090: connect: connection refused - There was an error returned querying the Prometheus API.

##Step 1: Check If Prometheus Is Running
##SSH into your VM:

gcloud compute ssh free-monitoring-vm --zone=europe-west2-a

##Run the following command:

sudo systemctl status prometheus

##✔ If running, you should see:

##● prometheus.service - Prometheus
   Active: active (running)
##❌ If not running, restart it:

sudo systemctl restart prometheus

##Check for errors:

sudo journalctl -u prometheus --no-pager | tail -20

##If it is not accessible, make sure port 9090 is open:

gcloud compute firewall-rules create prometheus-allow \
    --allow=tcp:9090 \
    --target-tags=http-server \
    --description="Allow Prometheus access on port 9090" \
    --direction=INGRESS \
    --priority=1000 \
    --network=default

```

## PHASE2- AUTOSCALING
## create metrics server
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

## verify metrics server
kubectl get deployment metrics-server -n kube-system


## Update the catalog-service-gke.yaml go to the end of file and paste the following-

---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: catalog-service-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: catalog-service
  minReplicas: 2
  maxReplicas: 5
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 60


## apply the changes
kubectl apply -f catalog-service-gke.yaml

# check if it works
kubectl get hpa

# install k6
brew install k6

# create a k6 script-
nano load-test.js

paste the following-

import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '1m', target: 100 },  // Ramp up to 100 users in 1 min
    { duration: '3m', target: 1000 },  // Hold at 500 users for 3 mins
    { duration: '1m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% requests should be < 500ms
  },
};

export default function () {
  let res = http.get('http://34.147.148.128/api/products');
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(1);
}


# run the script
k6 run load-test.js  


## Blue Green Deployment

## Create two different files for blue and green deployments

catalog-blue-deployment.yaml with the blue version

Run the Docker file to build the new image, tag it and push it , attach the path at the image path
Catalog-green-deployment.yaml with green version 

one common service file to switch between the both
Catalog-service-n.yaml  with current version as blue later switched it to green(new version).
This service will initially route traffic to both versions (Blue and Green). You can control which version receives traffic by adjusting the replica counts or updating the selector labels.
 
## Switch Traffic Between Blue and Green Versions
Once both Blue and Green versions are deployed, you can switch the traffic to the Green version by adjusting the Kubernetes deployment replicas or updating the service's selector.

1. Scale the Green deployment up to handle all traffic:
>kubectl scale deployment catalog-service-green --replicas=2

2. Scale the Blue deployment down to zero so that no traffic is routed to the Blue version:
>kubectl scale deployment catalog-service-blue --replicas=0
 Now, all traffic will be routed to the Green version.

## Rollback if needed (Blue-Green)
 If something goes wrong with the Green deployment, you can always roll back to the Blue version.
1.	Scale the Green deployment down:
>kubectl scale deployment catalog-service-green --replicas=0

2.	Scale the Blue deployment back up:
>kubectl scale deployment catalog-service-blue --replicas=2

This will route traffic back to the Blue version and allow you to fix the Green version.


