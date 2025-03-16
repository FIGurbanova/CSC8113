from flask import Flask, jsonify,Response
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST, Counter


app = Flask(__name__)
CORS(app)
app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://postgres:mysecretpassword@bookstore-db:5432/bookstore'
db = SQLAlchemy(app)

# Example Prometheus metric
REQUEST_COUNT = Counter('http_requests_total', 'Total number of HTTP requests')

@app.route('/metrics')
def metrics():
    return Response(generate_latest(), mimetype=CONTENT_TYPE_LATEST)

@app.route('/')
def home():
    REQUEST_COUNT.inc()  # Increment counter
    return "Catalog Service Running"
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