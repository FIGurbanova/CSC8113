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
  // const CATALOG_API = process.env.REACT_APP_API_BASE_URL ; // || 'http://localhost:5001'
  // const ORDER_API = process.env.REACT_APP_ORDER_SERVICE_URL ;// || 'http://localhost:8080'

  const CATALOG_API = "/api";
  const ORDER_API = "/api";

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