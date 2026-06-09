const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const PORT = 3000;

app.use(cors()); 
app.use(bodyParser.json());

// --- IN-MEMORY DATABASE ---
let users = [];
let carts = {}; 
let orders = [];

// --- HELPER FUNCTIONS ---

const logResponse = (method, path, message, data = null) => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] ${method} ${path}`);
    console.log(`   Status: ${message}`);
    if (data) console.log(`   Data:`, JSON.stringify(data, null, 2));
    console.log('-'.repeat(50));
};

// 1 Minute Interval Logic
const getDeliveryStatus = (orderDate) => {
    const startTime = new Date(orderDate).getTime();
    const currentTime = new Date().getTime();
    const elapsedMinutes = (currentTime - startTime) / 60000; // 60000ms = 1 min

    if (elapsedMinutes < 1) return 'Confirmed';
    if (elapsedMinutes < 2) return 'Shipped';
    if (elapsedMinutes < 3) return 'Out for Delivery';
    return 'Delivered';
};

// --- ROUTES ---

app.get('/', (req, res) => {
    res.send('DruvCart API is running...');
});

// Auth
app.post('/api/auth/signup', (req, res) => {
    const { email, password, username } = req.body;
    if (users.find(u => u.email === email)) return res.status(400).json({ error: 'Email exists' });
    const newUser = { userId: crypto.randomUUID(), email, password, username };
    users.push(newUser);
    carts[newUser.userId] = []; 
    logResponse('POST', '/api/auth/signup', 'User Created', { userId: newUser.userId });
    res.status(201).json({ message: 'User created', user: newUser });
});

app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    const user = users.find(u => u.email === email && u.password === password);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    logResponse('POST', '/api/auth/login', 'Logged In', { userId: user.userId });
    res.json({ message: 'Login successful', user });
});

// Cart
app.get('/api/cart/:userId', (req, res) => {
    res.json(carts[req.params.userId] || []);
});

app.post('/api/cart/:userId', (req, res) => {
    const { userId } = req.params;
    const { product } = req.body;
    if (!carts[userId]) carts[userId] = [];
    const item = carts[userId].find(i => i.productId === product.id);
    if (item) item.quantity++;
    else carts[userId].push({ id: crypto.randomUUID(), productId: product.id, name: product.name, price: product.price, image: product.image, quantity: 1 });
    logResponse('POST', `/api/cart/${userId}`, 'Item Added');
    res.json(carts[userId]);
});

app.put('/api/cart/:userId/:itemId', (req, res) => {
    const { userId, itemId } = req.params;
    const { delta } = req.body;
    if (!carts[userId]) return res.status(404).json({ error: 'Cart not found' });
    const idx = carts[userId].findIndex(i => i.id === itemId);
    if (idx > -1) {
        carts[userId][idx].quantity += delta;
        if (carts[userId][idx].quantity <= 0) carts[userId].splice(idx, 1);
        res.json(carts[userId]);
    } else res.status(404).json({ error: 'Item not found' });
});

app.delete('/api/cart/:userId/:itemId', (req, res) => {
    const { userId, itemId } = req.params;
    if (carts[userId]) {
        carts[userId] = carts[userId].filter(i => i.id !== itemId);
        res.json(carts[userId]);
    } else res.status(404).json({ error: 'Cart not found' });
});

// Orders
app.post('/api/orders/:userId', (req, res) => {
    const { userId } = req.params;
    const { items, totalAmount, shipping } = req.body;
    const newOrder = {
        id: crypto.randomUUID(),
        orderId: crypto.randomUUID().substring(0, 8).toUpperCase(),
        userId, items, totalAmount, shipping,
        orderDate: new Date().toISOString(),
        status: 'Confirmed',
        cancelledAt: null // Critical for freezing timeline
    };
    orders.unshift(newOrder);
    carts[userId] = []; 
    logResponse('POST', `/api/orders/${userId}`, 'Order Placed', { orderId: newOrder.orderId });
    res.status(201).json(newOrder);
});

app.get('/api/orders/:userId', (req, res) => {
    const userOrders = orders.filter(o => o.userId === req.params.userId);
    // Update statuses dynamically if active
    const updatedOrders = userOrders.map(o => {
        if (o.status !== 'Cancelled') o.status = getDeliveryStatus(o.orderDate);
        return o;
    });
    res.json(updatedOrders);
});

app.put('/api/orders/:orderId/cancel', (req, res) => {
    const order = orders.find(o => o.id === req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Only allow cancel if status is Confirmed (first 1 min)
    const status = getDeliveryStatus(order.orderDate);
    if (status !== 'Confirmed') return res.status(400).json({ error: `Too late to cancel. Order is ${status}` });

    order.status = 'Cancelled';
    order.cancelledAt = new Date().toISOString(); // Freeze timeline
    logResponse('PUT', `/api/orders/${order.id}/cancel`, 'Order Cancelled');
    res.json(order);
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});