import { PRODUCT_CATALOG, CATEGORIES, CAROUSEL_IMAGES } from './data.js';

// --- API CONFIGURATION ---
const API_URL = 'http://localhost:3000/api';

let cart = [];
let orders = [];
let currentView = 'Home';
let selectedProduct = null;
let checkoutStep = 1; 
let checkoutDetails = {};
let currentUser = null;

// Attempt to restore session
try {
    currentUser = JSON.parse(localStorage.getItem('druvcart_user'));
} catch (e) {
    currentUser = null;
}

// --- API HELPERS ---

const apiCall = async (endpoint, method = 'GET', body = null) => {
    try {
        const options = {
            method,
            headers: { 'Content-Type': 'application/json' }
        };
        if (body) options.body = JSON.stringify(body);

        const response = await fetch(`${API_URL}${endpoint}`, options);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'API Error');
        }
        return await response.json();
    } catch (error) {
        console.error(`API Error (${endpoint}):`, error);
        return null;
    }
};

// --- DATA MANAGEMENT ---

const loadData = async () => {
    updateAuthUI();
    if (currentUser) {
        const cartData = await apiCall(`/cart/${currentUser.userId}`);
        if (cartData) cart = cartData;
        
        const ordersData = await apiCall(`/orders/${currentUser.userId}`);
        if (ordersData) orders = ordersData;

        updateCartUI();
    } else {
        cart = [];
        orders = [];
        updateCartUI();
    }
};

// --- UTILITY FUNCTIONS ---

const showMessage = (title, message, type = 'alert', confirmCallback = null, cancelCallback = null) => {
    const modal = document.getElementById('custom-modal');
    const content = document.getElementById('modal-content');
    const okBtn = document.getElementById('modal-ok-btn');
    const confirmBtn = document.getElementById('modal-confirm-btn');
    const cancelBtn = document.getElementById('modal-cancel-btn');

    content.innerHTML = `
        <h3 class="text-xl font-bold text-gray-900 mb-2">${title}</h3>
        <p class="text-base text-gray-600">${message}</p>
    `;

    okBtn.classList.add('hidden');
    confirmBtn.classList.add('hidden');
    cancelBtn.classList.add('hidden');

    if (type === 'alert') {
        okBtn.classList.remove('hidden');
        okBtn.onclick = () => window.closeModal();
    } else if (type === 'confirm') {
        confirmBtn.classList.remove('hidden');
        cancelBtn.classList.remove('hidden');
        confirmBtn.onclick = () => { window.closeModal(); if (confirmCallback) confirmCallback(); };
        cancelBtn.onclick = () => { window.closeModal(); if (cancelCallback) cancelCallback(); };
    }

    modal.classList.remove('hidden');
};

window.closeModal = () => {
    document.getElementById('custom-modal').classList.add('hidden');
};

// --- AUTHENTICATION ---

const initAuth = () => {
    loadData();
};

const updateAuthUI = () => {
    const authButton = document.getElementById('auth-button');
    if (authButton) {
        if (currentUser) {
            authButton.classList.add('hidden');
            authButton.classList.remove('md:flex'); 
        } else {
            authButton.classList.remove('hidden');
            authButton.classList.add('md:flex'); 
        }
    }
};

window.handleAuthAction = async (type) => { 
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const username = document.getElementById('auth-username')?.value;
    const errorElement = document.getElementById('auth-error');
    errorElement.textContent = '';
    
    let response;
    try {
        if (type === 'signup') {
            response = await apiCall('/auth/signup', 'POST', { email, password, username });
        } else {
            response = await apiCall('/auth/login', 'POST', { email, password });
        }

        if (response && response.user) {
            currentUser = response.user;
            localStorage.setItem('druvcart_user', JSON.stringify(currentUser));
            await loadData(); 
            showMessage('Success', response.message || 'Welcome!', 'alert');
            navigate('Home');
        } else {
            errorElement.textContent = 'Authentication failed. Check credentials.';
        }
    } catch (e) {
        errorElement.textContent = e.message;
    }
};

window.logoutUser = () => {
    currentUser = null;
    cart = [];
    orders = [];
    localStorage.removeItem('druvcart_user');
    updateAuthUI();
    updateCartUI();
    showMessage('Signed Out', 'You have been successfully signed out.', 'alert');
    navigate('Home');
};

// --- CART LOGIC ---

const updateCartUI = () => {
    const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    const cartCountElement = document.getElementById('cart-count');
    
    if (cartCountElement) {
        if (totalCount > 0) {
            cartCountElement.textContent = totalCount;
            cartCountElement.classList.remove('hidden');
        } else {
            cartCountElement.classList.add('hidden');
        }
    }
};

window.addToCart = async (productId) => {
    if (!currentUser) return showMessage('Error', 'Please log in or sign up to add items to your cart.', 'alert');
    
    const product = PRODUCT_CATALOG.find(p => p.id === productId);
    if (!product) return;

    const updatedCart = await apiCall(`/cart/${currentUser.userId}`, 'POST', { product });
    if (updatedCart) {
        cart = updatedCart;
        updateCartUI();
        showMessage('Added to Cart', `${product.name} added to your cart.`, 'alert');
        if (currentView === 'Cart') renderCart();
    }
};
 
window.updateCartQuantity = async (docId, delta) => {
    if (!currentUser) return;
    
    const updatedCart = await apiCall(`/cart/${currentUser.userId}/${docId}`, 'PUT', { delta });
    if (updatedCart) {
        cart = updatedCart;
        updateCartUI();
        if (currentView === 'Cart') renderCart();
    }
};

window.removeFromCart = (docId) => {
    showMessage('Confirm Removal', 'Are you sure you want to remove this item from your cart?', 'confirm', async () => {
        if (!currentUser) return;
        
        const updatedCart = await apiCall(`/cart/${currentUser.userId}/${docId}`, 'DELETE');
        if (updatedCart) {
            cart = updatedCart;
            updateCartUI();
            showMessage('Removed', 'Item successfully removed from cart.', 'alert');
            if (currentView === 'Cart') renderCart();
        }
    });
};

window.handleCheckout = () => {
    if (!currentUser) {
        showMessage('Login Required', 'You must be logged in to checkout.', 'alert', () => navigate('Login'));
        return;
    }
    if (cart.length === 0) {
        showMessage('Cart Empty', 'Please add items to your cart first.', 'alert');
        return;
    }
    checkoutStep = 1; 
    navigate('Checkout');
};

// --- ORDER PROCESSING ---

window.placeOrder = async () => {
    if (!currentUser || cart.length === 0) return;

    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const total = subtotal + 15; 

    const orderData = {
        items: cart.map(item => ({ productId: item.productId, name: item.name, price: item.price, quantity: item.quantity })),
        totalAmount: total,
        shipping: checkoutDetails
    };

    const newOrder = await apiCall(`/orders/${currentUser.userId}`, 'POST', orderData);

    if (newOrder) {
        cart = []; 
        updateCartUI();
        checkoutStep = 4; // Show Success Screen
        renderCheckout();
    }
};

window.cancelOrder = async (orderId) => {
    const response = await apiCall(`/orders/${orderId}/cancel`, 'PUT');
    
    if (response && !response.error) {
        showMessage('Cancelled', `Order has been successfully cancelled.`, 'alert');
        const ordersData = await apiCall(`/orders/${currentUser.userId}`);
        if (ordersData) orders = ordersData;
        if (currentView === 'MyOrders') renderMyOrders();
    } else {
        showMessage('Error', response?.error || 'Could not cancel order.', 'alert');
    }
};

// --- ROUTING ---

window.navigate = async (view, data = null) => {
    if (currentUser) {
        await loadData(); 
    }

    currentView = view;
    const contentArea = document.getElementById('content-area');
    const headerTitle = document.getElementById('header-title');
    contentArea.innerHTML = '';
    
    headerTitle.textContent = view.includes('Detail') ? 'Product Details' : view.includes('Checkout') ? 'Checkout' : view.includes('TrackOrder') ? 'Track Order' : 'DruvCart';
    
    document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.remove('active-icon');
        const p = el.querySelector('p');
        if (p) {
            p.classList.remove('font-bold', 'text-primary');
            p.classList.add('font-medium', 'text-slate-500', 'dark:text-slate-400');
        }
    });
    const activeNavButton = Array.from(document.querySelectorAll('.nav-item')).find(btn => 
        btn.querySelector('p')?.textContent.trim() === (view === 'MyOrders' ? 'My Orders' : view === 'Products' ? 'Products' : view === 'Home' ? 'Home' : view === 'Cart' ? 'Cart' : view === 'Account' ? 'Profile' : 'Home')
    );
    if (activeNavButton) {
        activeNavButton.classList.add('active-icon');
        const p = activeNavButton.querySelector('p');
        if (p) {
            p.classList.add('font-bold', 'text-primary');
            p.classList.remove('font-medium', 'text-slate-500', 'dark:text-slate-400');
        }
    }

    const protectedViews = ['MyOrders', 'Account', 'Checkout', 'TrackOrder'];
    if (!currentUser && protectedViews.includes(view)) {
            showMessage('Access Denied', 'Please log in or sign up to access this page.', 'alert', () => navigate('Login'));
            return;
    }

    switch (view) {
        case 'Home': renderHome(); break;
        case 'Products': renderProducts(); break;
        case 'ProductDetail':
            selectedProduct = PRODUCT_CATALOG.find(p => p.id === data);
            if (selectedProduct) renderProductDetail();
            else navigate('Products');
            break;
        case 'Cart': renderCart(); break;
        case 'Checkout': renderCheckout(); break;
        case 'MyOrders': renderMyOrders(); break;
        case 'TrackOrder': renderTrackOrder(data); break;
        case 'Account': renderAccount(); break;
        case 'Search': renderSearch(); break;
        case 'Login': renderAuth('login'); break;
        case 'Signup': renderAuth('signup'); break;
        default: renderHome();
    }

    document.querySelectorAll('.material-symbols-outlined').forEach(icon => {
        if (icon.closest('.active-icon')) {
            icon.style.fontVariationSettings = `'FILL' 1, 'wght' 700`;
        } else {
                icon.style.fontVariationSettings = `'FILL' 0, 'wght' 400`;
        }
    });
    contentArea.scrollTop = 0;
};

// --- RENDER FUNCTIONS ---

let currentSlide = 0;
let slideInterval;
const renderHome = () => {
    document.getElementById('content-area').innerHTML = `
        <div class="overflow-hidden relative">
            <div id="carousel-track" class="carousel-track flex items-stretch p-4 gap-4">
                ${CAROUSEL_IMAGES.map((img, index) => {
                    let title = 'Latest Deals';
                    let subtitle = 'Shop our best electronics now!';
                    let shopAction = `Maps('Products')`;
                    
                    if (img === 'device1_ad.jpg') { title = 'Power Up Your Workflow'; subtitle = 'Up to 40% Off on select models.'; shopAction = `renderProducts('Laptops')`; } 
                    else if (img === 'device2_ad.jpg') { title = 'Next Gen Gadgets'; subtitle = 'Up to 40% Off on the latest tech.'; shopAction = `renderProducts('All')`; }
                    else if (img === 'device3_ad.jpg') { title = 'Seasonal Sale'; subtitle = 'Up to 40% Off on all items.'; shopAction = `renderProducts('All')`; }
                    else if (img === 'device4_ad.jpg') { title = 'Premium Electronics'; subtitle = 'Up to 40% Off on premium brands.'; shopAction = `renderProducts('All')`; }

                    return `
                    <div class="carousel-item flex h-full flex-1 flex-col gap-4 rounded-xl bg-white dark:bg-background-dark/50 shadow-[0_4px_12px_rgba(0,0,0,0.05)] min-w-[90vw] sm:min-w-[400px] md:min-w-[98%] md:mx-auto">
                        <div class="w-full bg-center bg-no-repeat aspect-[16/6] bg-cover rounded-xl flex flex-col justify-end p-6 md:p-10" data-alt="Carousel image ${index + 1}" style='background-image: url("${img}");'>
                            <h3 class="text-white text-3xl md:text-5xl font-extrabold leading-tight">${title}</h3>
                            <p class="text-white text-lg font-normal mt-2">${subtitle}</p>
                        </div>
                        <div class="flex flex-col flex-1 justify-between p-4 pt-0 gap-4">
                            <button onclick="${shopAction}" class="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-6 bg-primary text-white text-base font-bold leading-normal tracking-[0.015em] hover:bg-primary/90 transition-colors">
                                <span class="truncate">Shop Now</span>
                            </button>
                        </div>
                    </div>
                `;
                }).join('')}
            </div>
                <div id="carousel-dots" class="absolute bottom-20 left-1/2 -translate-x-1/2 flex gap-2 md:bottom-24"></div>
        </div>

        <h3 class="text-slate-900 dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] px-4 pb-2 pt-4 md:text-2xl">Shop by Category</h3>
        <div class="flex gap-3 px-4 pb-2 overflow-x-auto [-ms-scrollbar-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            ${CATEGORIES.map((cat, index) => `
                <button onclick="renderProducts('${cat}')" class="flex h-10 shrink-0 items-center justify-center gap-x-2 rounded-full ${cat === 'Smartphones' ? 'bg-primary/20 dark:bg-primary/30 text-primary dark:text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'} px-4 hover:bg-primary/30 transition-colors">
                    <span class="material-symbols-outlined text-base">${cat === 'Smartphones' ? 'phone_iphone' : cat === 'Laptops' ? 'laptop_mac' : cat === 'Audio' ? 'headphones' : 'watch'}</span>
                    <p class="text-sm font-medium leading-normal">${cat}</p>
                </button>
            `).join('')}
            <button onclick="renderProducts('All')" class="flex h-10 shrink-0 items-center justify-center gap-x-2 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-4 hover:bg-slate-300 transition-colors">
                <span class="material-symbols-outlined text-base">apps</span>
                <p class="text-sm font-medium leading-normal">All Products</p>
            </button>
        </div>

        <h3 class="text-slate-900 dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] px-4 pb-2 pt-6 md:text-2xl">Our Best Sellers</h3>
        <div class="product-grid-home">
            ${PRODUCT_CATALOG.slice(0, 8).map(p => `
                <div onclick="navigate('ProductDetail', ${p.id})" class="product-card flex flex-col gap-2 rounded-xl bg-container-light dark:bg-container-dark p-3 shadow-sm hover:shadow-lg transition-shadow cursor-pointer">
                    <div class="relative w-full">
                        <img class="product-image rounded-lg bg-slate-100 dark:bg-slate-700" data-alt="${p.name}" src="${p.image}"/>
                        <button onclick="event.stopPropagation(); addToCart(${p.id})" class="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white shadow-md hover:bg-primary/80 transition-colors">
                            <span class="material-symbols-outlined" style="font-size: 20px;">add_shopping_cart</span>
                        </button>
                    </div>
                    <div class="flex flex-col pt-2">
                        <p class="text-slate-800 dark:text-white text-base font-medium leading-normal truncate">${p.name}</p>
                        <p class="text-slate-900 dark:text-white text-lg font-bold text-primary mt-1">$${p.price.toFixed(2)}</p>
                        <div class="flex items-center gap-1 mt-1">
                            <div class="star-rating flex">
                                <span class="material-symbols-outlined text-base" style="font-variation-settings: 'FILL' 1;">star</span>
                                <span class="material-symbols-outlined text-base" style="font-variation-settings: 'FILL' 1;">star</span>
                                <span class="material-symbols-outlined text-base" style="font-variation-settings: 'FILL' 1;">star</span>
                                <span class="material-symbols-outlined text-base" style="font-variation-settings: 'FILL' 1;">star</span>
                                <span class="material-symbols-outlined text-base" style="font-variation-settings: 'FILL' 0;">star</span>
                            </div>
                            <p class="text-sm font-normal leading-normal text-slate-500 dark:text-slate-400">4.7</p>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    initCarousel();
};

const initCarousel = () => {
    if (slideInterval) clearInterval(slideInterval);

    const track = document.getElementById('carousel-track');
    const dotsContainer = document.getElementById('carousel-dots');
    const items = track?.querySelectorAll('.carousel-item');
    const totalSlides = items?.length;

    if (!track || !dotsContainer || !items) return;

    dotsContainer.innerHTML = Array.from({ length: totalSlides }).map((_, index) => `
        <div class="h-2 w-2 rounded-full ${index === 0 ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'} transition-colors cursor-pointer" onclick="goToSlide(${index})"></div>
    `).join('');

    window.goToSlide = (index) => {
        if (index < 0) index = totalSlides - 1;
        if (index >= totalSlides) index = 0;
        currentSlide = index;
        const percentage = currentSlide * 100;
        track.style.transform = `translateX(-${percentage}%)`;
        
        dotsContainer.querySelectorAll('div').forEach((dot, i) => {
            dot.className = `h-2 w-2 rounded-full ${i === currentSlide ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'} transition-colors cursor-pointer`;
        });
    };

    const nextSlide = () => goToSlide(currentSlide + 1);

    slideInterval = setInterval(nextSlide, 2000); 
};

let currentCategoryFilter = 'All';
window.renderProducts = (category = 'All') => {
    currentCategoryFilter = category;
    const filteredProducts = category === 'All'
        ? PRODUCT_CATALOG
        : PRODUCT_CATALOG.filter(p => p.category === category);

    document.getElementById('content-area').innerHTML = `
        <header class="sticky top-16 md:top-0 z-10 flex gap-3 p-4 overflow-x-auto border-b border-border-light/50 dark:border-border-light/10 bg-background-light dark:bg-background-dark">
            <button class="flex h-10 shrink-0 items-center justify-center gap-x-2 rounded-lg bg-slate-200/60 dark:bg-slate-800/60 px-4 hover:bg-slate-300 transition-colors">
                <span class="material-symbols-outlined text-slate-700 dark:text-slate-300" style="font-size: 20px;">tune</span>
                <p class="text-sm font-medium leading-normal text-slate-900 dark:text-slate-100">Filter</p>
            </button>
            <select id="sort-select" onchange="sortProducts(this.value)" class="flex h-10 shrink-0 items-center justify-center gap-x-2 rounded-lg bg-slate-200/60 dark:bg-slate-800/60 px-4 text-sm font-medium leading-normal text-slate-900 dark:text-slate-100 border-none focus:ring-primary">
                <option value="relevance">Sort by: Relevance</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="name-asc">Name: A-Z</option>
            </select>
        </header>

        <h1 class="text-2xl font-bold leading-tight tracking-[-0.015em] px-4 pt-4 md:text-3xl">${category} Products</h1>

        <div id="product-grid" class="product-grid-home">
            ${renderProductCards(filteredProducts)}
        </div>
    `;
    document.getElementById('header-title').textContent = category === 'All' ? 'Products' : category;
};

window.renderProductCards = (products) => {
        return products.map(p => `
        <div onclick="navigate('ProductDetail', ${p.id})" class="product-card flex flex-col gap-2 rounded-xl bg-container-light dark:bg-container-dark p-3 shadow-sm hover:shadow-lg transition-shadow cursor-pointer">
            <div class="relative w-full">
                <img class="product-image rounded-lg bg-slate-100 dark:bg-slate-800" data-alt="${p.name}" src="${p.image}"/>
                <button onclick="event.stopPropagation(); addToCart(${p.id})" class="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white shadow-md hover:bg-primary/80 transition-colors">
                    <span class="material-symbols-outlined" style="font-size: 20px;">add_shopping_cart</span>
                </button>
            </div>
            <div class="flex flex-col pt-2">
                <p class="text-base font-semibold leading-normal text-slate-900 dark:text-slate-100 truncate">${p.name}</p>
                <p class="text-lg font-bold leading-normal text-primary mt-1">$${p.price.toFixed(2)}</p>
                <div class="flex items-center gap-1 mt-1">
                    <div class="star-rating flex">
                        <span class="material-symbols-outlined text-base" style="font-variation-settings: 'FILL' 1;">star</span>
                        <span class="material-symbols-outlined text-base" style="font-variation-settings: 'FILL' 1;">star</span>
                        <span class="material-symbols-outlined text-base" style="font-variation-settings: 'FILL' 1;">star</span>
                        <span class="material-symbols-outlined text-base" style="font-variation-settings: 'FILL' 1;">star</span>
                        <span class="material-symbols-outlined text-base" style="font-variation-settings: 'FILL' 0;">star</span>
                    </div>
                    <p class="text-sm font-normal leading-normal text-slate-500 dark:text-slate-400">4.7</p>
                </div>
            </div>
        </div>
    `).join('');
}

window.sortProducts = (sortBy) => {
    let products = currentCategoryFilter === 'All'
        ? [...PRODUCT_CATALOG]
        : PRODUCT_CATALOG.filter(p => p.category === currentCategoryFilter);
    
    if (sortBy === 'price-asc') products.sort((a, b) => a.price - b.price);
    else if (sortBy === 'price-desc') products.sort((a, b) => b.price - a.price);
    else if (sortBy === 'name-asc') products.sort((a, b) => a.name.localeCompare(b.name));

    document.getElementById('product-grid').innerHTML = renderProductCards(products);
}

// --- RENDER PRODUCT DETAIL ---
const renderProductDetail = () => {
    if (!selectedProduct) return;
    document.getElementById('content-area').innerHTML = `
        <!-- Image Carousel (Adapted from static snippet) -->
        <div class="relative w-full">
            <div class="flex overflow-x-auto snap-x snap-mandatory [-ms-scrollbar-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div class="flex-shrink-0 w-full snap-center">
                    <img class="w-full h-80 object-cover" data-alt="${selectedProduct.name}" src="${selectedProduct.image}"/>
                </div>
            </div>
            <div class="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                <div class="h-2 w-2 rounded-full bg-primary"></div>
                <div class="h-2 w-2 rounded-full bg-gray-300 dark:bg-gray-600"></div>
                <div class="h-2 w-2 rounded-full bg-gray-300 dark:bg-gray-600"></div>
            </div>
        </div>

        <!-- Product Info Section (Adapted from static snippet) -->
        <div class="p-4 space-y-4 bg-container-light dark:bg-container-dark">
            <p class="text-sm font-normal text-text-secondary dark:text-gray-400">By DruvCart Select</p>
            <h1 class="text-2xl font-bold leading-tight tracking-tight text-text-light dark:text-text-dark md:text-3xl">${selectedProduct.name}</h1>
            <div class="flex items-center gap-2">
                <div class="flex text-yellow-500">
                    <span class="material-symbols-outlined text-base" style="font-variation-settings: 'FILL' 1;">star</span>
                    <span class="material-symbols-outlined text-base" style="font-variation-settings: 'FILL' 1;">star</span>
                    <span class="material-symbols-outlined text-base" style="font-variation-settings: 'FILL' 1;">star</span>
                    <span class="material-symbols-outlined text-base" style="font-variation-settings: 'FILL' 1;">star</span>
                    <span class="material-symbols-outlined text-base">star_half</span>
                </div>
                <p class="text-sm font-medium text-text-secondary dark:text-gray-400">4.8 (2,187 reviews)</p>
            </div>
            <p class="text-3xl font-bold text-text-light dark:text-text-dark">$${selectedProduct.price.toFixed(2)}</p>
            
            <div class="flex flex-wrap gap-2 pt-2">
                ${selectedProduct.specs.map(spec => `<span class="inline-flex items-center rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">${spec}</span>`).join('')}
            </div>
        </div>

        <!-- Tab Navigation Section (Description Only) -->
        <div class="mt-4 bg-container-light dark:bg-container-dark">
            <div class="border-b border-border-light dark:border-border-light/10">
                <nav aria-label="Tabs" class="-mb-px flex space-x-6 px-4">
                    <a class="shrink-0 border-b-2 border-primary px-1 py-3 text-sm font-semibold text-primary" href="#">Description</a>
                    <a class="shrink-0 border-b-2 border-transparent px-1 py-3 text-sm font-semibold text-text-secondary dark:text-gray-400" href="#">Specs</a>
                    <a class="shrink-0 border-b-2 border-transparent px-1 py-3 text-sm font-semibold text-text-secondary dark:text-gray-400" href="#">Reviews</a>
                </nav>
            </div>
            <div class="p-4 space-y-3">
                <h3 class="text-lg font-semibold text-text-light dark:text-text-dark">Product Description</h3>
                <p class="text-sm leading-relaxed text-text-secondary dark:text-gray-400">${selectedProduct.description}</p>
            </div>
        </div>

        <!-- Floating Action Bar -->
        <footer class="fixed bottom-0 left-0 right-0 z-10 border-t border-border-light dark:border-border-light/10 bg-background-light dark:bg-background-dark p-4 md:relative md:border-none md:shadow-none md:mt-6">
            <div class="flex items-center gap-4 max-w-lg mx-auto md:max-w-4xl">
                <button class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border border-border-light dark:border-gray-700 bg-container-light dark:bg-container-dark text-text-light dark:text-text-dark hover:bg-gray-100 transition-colors">
                    <span class="material-symbols-outlined">favorite_border</span>
                </button>
                <button onclick="addToCart(${selectedProduct.id})" class="h-12 flex-1 rounded-xl bg-primary text-base font-bold text-white shadow-lg shadow-primary/30 hover:bg-primary/90 transition-colors">Add to Cart</button>
            </div>
        </footer>
    `;
};

// --- RENDER CART ---
const renderCart = () => {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const shipping = subtotal > 0 ? 15.00 : 0.00;
    const total = subtotal + shipping;

    document.getElementById('content-area').innerHTML = `
        <div class="p-4 pb-64"> <!-- Added pb-64 for scrolling -->
            <h2 class="text-xl font-semibold mb-4 md:text-3xl">My Cart</h2>
            <div class="space-y-4">
                ${cart.length === 0 ? '<p class="text-center text-gray-500 py-10 bg-white rounded-xl shadow-sm">Your cart is empty.</p>' : cart.map(item => `
                    <div class="flex items-start gap-4 rounded-lg border border-border-light dark:border-gray-700 bg-container-light dark:bg-container-dark p-4">
                        <div class="h-24 w-24 shrink-0 overflow-hidden rounded-md">
                            <img class="h-full w-full object-cover" data-alt="${item.name}" src="${item.image}"/>
                        </div>
                        <div class="flex flex-1 flex-col justify-between self-stretch">
                            <div>
                                <p class="text-base font-medium leading-tight text-text-light dark:text-text-dark">${item.name}</p>
                                <p class="mt-1 text-sm text-text-secondary dark:text-gray-400">$${item.price.toFixed(2)}</p>
                            </div>
                            <div class="mt-2 flex items-center justify-between">
                                <div class="flex items-center gap-2 border border-border-light dark:border-gray-600 rounded-full">
                                    <button onclick="updateCartQuantity('${item.id}', -1)" class="flex h-7 w-7 items-center justify-center rounded-full text-text-light dark:text-text-dark hover:bg-slate-100 dark:hover:bg-zinc-700">-</button>
                                    <span class="w-8 text-center text-sm font-medium text-text-light dark:text-text-dark">${item.quantity}</span>
                                    <button onclick="updateCartQuantity('${item.id}', 1)" class="flex h-7 w-7 items-center justify-center rounded-full text-text-light dark:text-text-dark hover:bg-slate-100 dark:hover:bg-zinc-700">+</button>
                                </div>
                                <button onclick="removeFromCart('${item.id}')" class="text-destructive hover:bg-red-50 p-1 rounded-full">
                                    <span class="material-symbols-outlined !text-xl">delete</span>
                                </button>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
        
        <!-- Order Summary Footer -->
        <footer class="fixed bottom-0 left-0 right-0 z-10 border-t border-border-light dark:border-gray-800 bg-background-light dark:bg-background-dark p-4">
            <div class="mx-auto w-full max-w-4xl">
                <!-- Promo Code -->
                <div class="flex items-center gap-2">
                    <input class="h-12 flex-1 rounded-lg border border-border-light dark:border-gray-700 bg-white dark:bg-zinc-800 px-4 text-sm focus:border-primary focus:ring-primary dark:placeholder:text-gray-400" placeholder="Enter promo code" type="text"/>
                    <button class="h-12 shrink-0 rounded-lg bg-slate-200 dark:bg-zinc-700 px-4 text-sm font-medium text-text-light dark:text-text-dark hover:bg-slate-300 transition-colors">Apply</button>
                </div>
                <!-- Price Breakdown -->
                <div class="mt-4 space-y-2">
                    <div class="flex justify-between gap-x-6">
                        <p class="text-sm text-text-secondary dark:text-gray-400">Subtotal</p>
                        <p class="text-sm font-medium text-text-light dark:text-text-dark">$${subtotal.toFixed(2)}</p>
                    </div>
                    <div class="flex justify-between gap-x-6">
                        <p class="text-sm text-text-secondary dark:text-gray-400">Shipping</p>
                        <p class="text-sm font-medium text-text-light dark:text-text-dark">$${shipping.toFixed(2)}</p>
                    </div>
                    <div class="flex justify-between gap-x-6 border-t border-dashed border-border-light dark:border-gray-700 pt-2 mt-2">
                        <p class="text-base font-bold text-text-light dark:text-text-dark">Total</p>
                        <p class="text-base font-bold text-right text-primary">$${total.toFixed(2)}</p>
                    </div>
                </div>
                <!-- Checkout Button -->
                <button onclick="handleCheckout()" 
                        class="mt-4 h-14 w-full rounded-lg bg-primary text-base font-bold text-white shadow-lg shadow-primary/30 hover:bg-primary/90 transition-colors ${cart.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}">
                    Proceed to Checkout
                </button>
            </div>
        </footer>
    `;
};

// --- RENDER CHECKOUT ---
const renderCheckout = () => {
    document.getElementById('content-area').innerHTML = `
        <div class="max-w-lg mx-auto pb-24">
            <!-- Progress Stepper -->
            <div class="px-4 py-5">
                <div class="flex items-center">
                    ${renderCheckoutStepUI(1, 'Shipping')}
                    <div class="flex-auto border-t-2 ${checkoutStep >= 2 ? 'border-primary' : 'border-gray-200 dark:border-gray-700'} mx-2 transition-colors duration-300"></div>
                    ${renderCheckoutStepUI(2, 'Payment')}
                    <div class="flex-auto border-t-2 ${checkoutStep >= 3 ? 'border-primary' : 'border-gray-200 dark:border-gray-700'} mx-2 transition-colors duration-300"></div>
                    ${renderCheckoutStepUI(3, 'Success')}
                </div>
            </div>
            
            <div id="checkout-content" class="flex flex-col"></div>
        </div>
        <!-- Sticky Footer with CTA (Hide on Success Step 4) -->
        ${checkoutStep < 4 ? `
        <div class="sticky bottom-0 mt-auto w-full bg-background-light dark:bg-background-dark border-t border-border-light dark:border-gray-800 pt-4 pb-6 px-4">
            <button onclick="prevCheckoutStep()" class="flex w-full items-center justify-center rounded-xl bg-gray-200 dark:bg-gray-700 px-6 py-4 text-base font-bold text-text-light dark:text-text-dark shadow-sm transition-all hover:bg-gray-300 dark:hover:bg-gray-600">
                Back to ${checkoutStep === 1 ? 'Cart' : 'Shipping'}
            </button>
        </div>` : ''}
    `;
    renderCurrentCheckoutStep();
};

const renderCheckoutStepUI = (step, title) => {
    const isActive = checkoutStep === step;
    const isComplete = checkoutStep > step || checkoutStep === 4; // Success completes all steps visually
    const circleClass = isComplete || isActive ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-gray-700 text-text-light dark:text-gray-400';
    const textClass = isComplete || isActive ? 'font-semibold text-primary' : 'font-medium text-gray-500 dark:text-gray-400';

    return `
        <div class="flex flex-col items-center">
            <div class="flex h-8 w-8 items-center justify-center rounded-full ${circleClass} text-sm font-bold transition-colors duration-300">
                ${isComplete ? `<span class="material-symbols-outlined !text-lg">check</span>` : step}
            </div>
            <p class="mt-2 text-xs ${textClass} transition-colors duration-300">${title}</p>
        </div>
    `;
};

const renderCurrentCheckoutStep = () => {
    const contentArea = document.getElementById('checkout-content');
    if (checkoutStep === 1) {
        contentArea.innerHTML = `
            <h1 class="text-text-light dark:text-white tracking-light text-[32px] font-bold leading-tight px-4 text-left pb-3 pt-4">Shipping Address</h1>
            <form id="shipping-form" onsubmit="event.preventDefault(); nextCheckoutStep()">
                <div class="flex flex-col gap-y-1 px-4 py-3">
                    <label class="flex flex-col">
                        <p class="text-text-light dark:text-gray-300 text-base font-medium leading-normal pb-2">Full Name</p>
                        <input type="text" id="fullName" class="form-input flex w-full rounded-lg text-text-light dark:text-white border border-border-light dark:border-gray-600 bg-background-light dark:bg-background-dark h-14 p-[15px] focus:border-primary dark:focus:border-primary" placeholder="John Doe" value="${checkoutDetails.fullName || 'John Doe'}" required>
                    </label>
                </div>
                <div class="flex flex-col gap-y-1 px-4 py-3">
                    <label class="flex flex-col">
                        <p class="text-text-light dark:text-gray-300 text-base font-medium leading-normal pb-2">Address Line 1</p>
                        <input type="text" id="address1" class="form-input flex w-full rounded-lg text-text-light dark:text-white border border-border-light dark:border-gray-600 bg-background-light dark:bg-background-dark h-14 p-[15px] focus:border-primary dark:focus:border-primary" placeholder="123 Market St." value="${checkoutDetails.address1 || '123 Market St.'}" required>
                    </label>
                </div>
                <div class="flex flex-col gap-y-1 px-4 py-3">
                    <label class="flex flex-col">
                        <p class="text-text-light dark:text-gray-300 text-base font-medium leading-normal pb-2">Address Line 2 <span class="text-gray-400">(Optional)</span></p>
                        <input type="text" id="address2" class="form-input flex w-full rounded-lg text-text-light dark:text-white border border-border-light dark:border-gray-600 bg-background-light dark:bg-background-dark h-14 p-[15px] focus:border-primary dark:focus:border-primary" placeholder="Apt, suite, etc." value="${checkoutDetails.address2 || ''}">
                    </label>
                </div>
                <div class="flex w-full flex-wrap items-end gap-4 px-4 py-3">
                    <label class="flex flex-col min-w-40 flex-1">
                        <p class="text-text-light dark:text-gray-300 text-base font-medium leading-normal pb-2">City</p>
                        <input type="text" id="city" class="form-input flex w-full rounded-lg text-text-light dark:text-white border border-border-light dark:border-gray-600 bg-background-light dark:bg-background-dark h-14 p-[15px] focus:border-primary dark:focus:border-primary" placeholder="City" value="${checkoutDetails.city || 'San Francisco'}" required>
                    </label>
                    <label class="flex flex-col min-w-20 flex-1">
                        <p class="text-text-light dark:text-gray-300 text-base font-medium leading-normal pb-2">ZIP Code</p>
                        <input type="text" id="zipCode" class="form-input flex w-full rounded-lg text-text-light dark:text-white border border-border-light dark:border-gray-600 bg-background-light dark:bg-background-dark h-14 p-[15px] focus:border-primary dark:focus:border-primary" placeholder="ZIP" value="${checkoutDetails.zipCode || '94103'}" required>
                    </label>
                </div>
                <div class="px-4 py-4">
                    <label class="flex items-center space-x-3">
                        <input id="billing-checkbox" type="checkbox" checked class="form-checkbox h-5 w-5 rounded text-primary focus:ring-primary/50 border-border-light dark:border-gray-600 bg-background-light dark:bg-background-dark">
                        <span class="text-text-light dark:text-gray-300">Use this as my billing address</span>
                    </label>
                </div>
                <div class="px-4">
                    <button type="submit" class="flex w-full items-center justify-center rounded-xl bg-primary px-6 py-4 text-base font-bold text-white shadow-sm transition-all hover:bg-primary/90">
                        Continue to Payment
                    </button>
                </div>
            </form>
        `;
    } else if (checkoutStep === 2) {
        // Payment
        contentArea.innerHTML = `
            <h1 class="text-text-light dark:text-white tracking-light text-[32px] font-bold leading-tight px-4 text-left pb-3 pt-4">Payment</h1>
            <form id="payment-form" onsubmit="event.preventDefault(); nextCheckoutStep()">
                <div class="flex flex-col gap-y-1 px-4 py-3">
                    <label class="flex flex-col">
                        <p class="text-text-light dark:text-gray-300 text-base font-medium leading-normal pb-2">Card Number</p>
                        <input type="text" id="cardNumber" placeholder="**** **** **** 1234" class="form-input flex w-full rounded-lg text-text-light dark:text-white border border-border-light dark:border-gray-600 bg-background-light dark:bg-background-dark h-14 p-[15px] focus:border-primary dark:focus:border-primary" required>
                    </label>
                </div>
                 <div class="flex flex-col gap-y-1 px-4 py-3">
                    <label class="flex flex-col">
                        <p class="text-text-light dark:text-gray-300 text-base font-medium leading-normal pb-2">Name on Card</p>
                        <input type="text" id="cardName" placeholder="John Doe" class="form-input flex w-full rounded-lg text-text-light dark:text-white border border-border-light dark:border-gray-600 bg-background-light dark:bg-background-dark h-14 p-[15px] focus:border-primary dark:focus:border-primary" required>
                    </label>
                </div>
                <div class="flex w-full flex-wrap items-end gap-4 px-4 py-3">
                    <label class="flex flex-col min-w-40 flex-1">
                        <p class="text-text-light dark:text-gray-300 text-base font-medium leading-normal pb-2">Expiration Date</p>
                        <input type="text" id="expDate" placeholder="MM/YY" class="form-input flex w-full rounded-lg text-text-light dark:text-white border border-border-light dark:border-gray-600 bg-background-light dark:bg-background-dark h-14 p-[15px] focus:border-primary dark:focus:border-primary" required>
                    </label>
                    <label class="flex flex-col min-w-20 flex-1">
                        <p class="text-text-light dark:text-gray-300 text-base font-medium leading-normal pb-2">CVV</p>
                        <input type="text" id="cvv" placeholder="123" class="form-input flex w-full rounded-lg text-text-light dark:text-white border border-border-light dark:border-gray-600 bg-background-light dark:bg-background-dark h-14 p-[15px] focus:border-primary dark:focus:border-primary" required>
                    </label>
                </div>
                <div class="px-4 pt-4">
                    <button type="submit" class="flex w-full items-center justify-center rounded-xl bg-primary px-6 py-4 text-base font-bold text-white shadow-sm transition-all hover:bg-primary/90">
                        Confirm Payment
                    </button>
                </div>
            </form>
        `;
    } else if (checkoutStep === 4) {
        // Success Screen
        contentArea.innerHTML = `
            <div class="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div class="w-20 h-20 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-6">
                    <span class="material-symbols-outlined text-5xl text-green-600 dark:text-green-400">check_circle</span>
                </div>
                <h1 class="text-3xl font-bold text-text-light dark:text-white mb-2">Payment Successful!</h1>
                <p class="text-text-secondary dark:text-gray-400 mb-8 max-w-md">
                    Thank you for your purchase. Your order has been confirmed and will be shipped shortly.
                </p>
                <button onclick="navigate('MyOrders')" class="flex w-full max-w-xs items-center justify-center rounded-xl bg-primary px-6 py-4 text-base font-bold text-white shadow-lg hover:bg-primary/90 transition-all">
                    View Your Orders
                </button>
            </div>
        `;
    }
}

window.nextCheckoutStep = () => {
    if (checkoutStep === 1) {
        const form = document.getElementById('shipping-form');
        if (!form.checkValidity()) { form.reportValidity(); return; }
        checkoutDetails = {
            fullName: document.getElementById('fullName').value,
            address1: document.getElementById('address1').value,
            address2: document.getElementById('address2').value,
            city: document.getElementById('city').value,
            zipCode: document.getElementById('zipCode').value,
        };
        checkoutStep++;
        renderCheckout();
    } else if (checkoutStep === 2) {
        const form = document.getElementById('payment-form');
        if (!form.checkValidity()) { form.reportValidity(); return; }
        placeOrder(); // Direct placement
    }
};

window.prevCheckoutStep = () => {
    if (checkoutStep > 1) {
        checkoutStep--;
        renderCheckout();
    } else {
        navigate('Cart');
    }
};

// --- RENDER MY ORDERS ---
const renderMyOrders = () => {
    document.getElementById('content-area').innerHTML = `
        <h2 class="text-2xl font-bold text-text-light dark:text-text-dark mb-6 md:text-3xl px-4 pt-4">My Orders</h2>
        <div class="space-y-4 p-4">
            ${orders.length === 0 ? '<p class="text-center text-gray-500 py-10 bg-white rounded-xl shadow-sm">You have no orders yet. Go shop now!</p>' : orders.map(order => {
                const { currentStatus } = getTimeline(order);
                const isCanceled = order.status === 'Cancelled';
                const displayStatus = isCanceled ? 'Cancelled' : currentStatus;
                
                return `
                    <div class="bg-container-light dark:bg-container-dark p-4 rounded-xl shadow-lg border border-border-light dark:border-gray-700">
                        <div class="flex justify-between items-start mb-3 border-b border-border-light dark:border-gray-700 pb-2">
                            <div>
                                <p class="text-sm font-medium text-text-secondary dark:text-gray-400">Order ID: <span class="font-bold text-text-light dark:text-text-dark">${order.orderId}</span></p>
                                <p class="text-xs text-text-secondary dark:text-gray-400">Placed on: ${new Date(order.orderDate).toLocaleDateString()}</p>
                            </div>
                            <span class="px-3 py-1 text-xs font-bold rounded-full ${displayStatus === 'Delivered' ? 'bg-green-100 text-green-700' : displayStatus === 'Cancelled' ? 'bg-red-100 text-red-700' : 'bg-primary/20 text-primary'}">${displayStatus}</span>
                        </div>

                        <p class="text-lg font-bold text-text-light dark:text-text-dark mb-2">Total: $${order.totalAmount.toFixed(2)}</p>
                        
                        <div class="text-sm text-text-secondary dark:text-gray-400 mb-3">
                            ${order.items.map(item => `${item.name} (x${item.quantity})`).join(', ')}
                        </div>

                        <div class="flex justify-between space-x-2">
                            <button onclick="navigate('TrackOrder', '${order.id}')" class="flex-grow py-2 text-sm font-semibold text-primary border border-primary rounded-xl hover:bg-primary/10 transition duration-150">
                                <span class="material-symbols-outlined !text-sm mr-1">history</span> Track Order
                            </button>
                            <button onclick="cancelOrder('${order.id}')" class="w-24 py-2 text-sm font-semibold text-destructive border border-destructive rounded-xl hover:bg-red-50 transition duration-150 ${displayStatus !== 'Confirmed' ? 'opacity-50 cursor-not-allowed' : ''}" ${displayStatus !== 'Confirmed' ? 'disabled' : ''}>
                                Cancel
                            </button>
                        </div>
                    </div>
                `;}
            ).join('')}
        </div>
    `;
};

// --- RENDER TRACK ORDER ---
const renderTrackOrder = (orderId) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) {
        navigate('MyOrders');
        return;
    }
    
    const { timeline, currentStatus } = getTimeline(order); 
    
    document.getElementById('content-area').innerHTML = `
        <div class="p-4">
            <h2 class="text-2xl font-bold text-text-light dark:text-text-dark mb-4 md:text-3xl">Track Order</h2>
            
            <div class="bg-container-light dark:bg-container-dark p-4 rounded-xl shadow-lg border border-border-light dark:border-gray-700 mb-6">
                <div class="flex justify-between items-start mb-3">
                    <div>
                        <p class="text-sm font-medium text-text-secondary dark:text-gray-400">Order ID: <span class="font-bold text-text-light dark:text-text-dark">${order.orderId}</span></p>
                        <p class="text-xs text-text-secondary dark:text-gray-400">Placed on: ${new Date(order.orderDate).toLocaleDateString()}</p>
                    </div>
                    <span class="px-3 py-1 text-xs font-bold rounded-full ${currentStatus === 'Delivered' ? 'bg-green-100 text-green-700' : currentStatus === 'Cancelled' ? 'bg-red-100 text-red-700' : 'bg-primary/20 text-primary'}">${currentStatus}</span>
                </div>

                <p class="text-lg font-bold text-text-light dark:text-text-dark mb-2">Total: $${order.totalAmount.toFixed(2)}</p>
                
                <div class="text-sm text-text-secondary dark:text-gray-400">
                    ${order.items.map(item => `${item.name} (x${item.quantity})`).join(', ')}
                </div>
            </div>

            <div class="bg-container-light dark:bg-container-dark p-4 rounded-xl shadow-lg border border-border-light dark:border-gray-700">
                <h3 class="text-lg font-bold text-text-light dark:text-text-dark mb-4">Order Timeline</h3>
                
                <div class="relative pl-6">
                    <div class="absolute top-0 left-3 h-full w-0.5 bg-gray-200"></div>
                    ${timeline.map((step, index) => {
                        const circleClass = step.complete ? 'bg-primary' : 'bg-gray-300';
                        const textClass = step.complete ? 'text-gray-900 font-medium' : 'text-gray-500';
                        const dateText = step.timestamp ? new Date(step.timestamp).toLocaleString() : 'Pending...';

                        return `
                            <div class="mb-6 relative">
                                <div class="absolute left-0 -translate-x-1/2 top-1 w-6 h-6 rounded-full ${circleClass} flex items-center justify-center text-white">
                                    ${step.complete ? `<span class="material-symbols-outlined !text-sm">check</span>` : index + 1}
                                </div>
                                <div class="ml-4">
                                    <p class="text-base ${textClass}">${step.status}</p>
                                    <p class="text-xs text-gray-500">${dateText}</p>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>

            <div class="mt-6">
                <button onclick="navigate('MyOrders')" class="w-full py-3 text-base font-semibold text-primary border border-primary rounded-xl hover:bg-primary/10 transition duration-150">
                    Back to My Orders
                </button>
            </div>
        </div>
    `;
};

// --- UTILS FOR TRACKING ---
const getTimeline = (orderOrDate) => {
    let orderDate, isCancelled, cancelledAt;
    
    if (typeof orderOrDate === 'string') {
        orderDate = orderOrDate;
        isCancelled = false;
        cancelledAt = null;
    } else {
        orderDate = orderOrDate.orderDate;
        isCancelled = orderOrDate.status === 'Cancelled';
        cancelledAt = orderOrDate.cancelledAt;
    }

    const statuses = ['Confirmed', 'Shipped', 'Out for Delivery', 'Delivered'];
    const startTime = new Date(orderDate).getTime();
    const currentTime = new Date().getTime();
    const minute = 60 * 1000; 
    
    const referenceTime = (isCancelled && cancelledAt) 
        ? new Date(cancelledAt).getTime() 
        : new Date().getTime();

    const timeline = statuses.map((status, index) => {
        const requiredTime = index * minute; 
        const complete = (referenceTime - startTime) >= requiredTime;
        const timestamp = complete ? new Date(startTime + requiredTime).toISOString() : null;
        return { status, complete, timestamp };
    });

    let currentStatus = 'Confirmed';
    if (isCancelled) {
        currentStatus = 'Cancelled';
    } else {
        if (timeline[3].complete) currentStatus = 'Delivered';
        else if (timeline[2].complete) currentStatus = 'Out for Delivery';
        else if (timeline[1].complete) currentStatus = 'Shipped';
    }

    return { currentStatus, timeline };
};

// --- RENDER AUTH & ACCOUNT ---

const renderAuth = (type) => {
    const isLogin = type === 'login';
    const title = isLogin ? 'Log In' : 'Create an Account';
    const switchLink = isLogin
        ? `<p class="text-center text-sm text-text-secondary dark:text-gray-400">Don't have an account? <a href="#" onclick="navigate('Signup')" class="text-primary font-medium hover:underline">Sign Up</a></p>`
        : `<p class="text-center text-sm text-text-secondary dark:text-gray-400">Already have an account? <a href="#" onclick="navigate('Login')" class="text-primary font-medium hover:underline">Log In</a></p>`;

    document.getElementById('content-area').innerHTML = `
        <div class="mt-8 p-6 bg-white dark:bg-container-dark rounded-xl shadow-lg border border-border-light dark:border-gray-700 max-w-sm mx-auto">
            <h2 class="text-3xl font-bold text-text-light dark:text-text-dark mb-6 text-center">${title}</h2>
            <form onsubmit="event.preventDefault(); handleAuthAction('${type}')" class="space-y-4">
                ${!isLogin ? `
                <div>
                    <label for="auth-username" class="block text-sm font-medium text-text-light dark:text-gray-300">Username</label>
                    <input type="text" id="auth-username" class="mt-1 block w-full rounded-lg border-border-light dark:border-gray-600 shadow-sm p-3 focus:border-primary focus:ring-primary bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark" required>
                </div>` : ''}
                <div>
                    <label for="auth-email" class="block text-sm font-medium text-text-light dark:text-gray-300">Email</label>
                    <input type="email" id="auth-email" class="mt-1 block w-full rounded-lg border-border-light dark:border-gray-600 shadow-sm p-3 focus:border-primary focus:ring-primary bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark" required>
                </div>
                <div>
                    <label for="auth-password" class="block text-sm font-medium text-text-light dark:text-gray-300">Password</label>
                    <input type="password" id="auth-password" class="mt-1 block w-full rounded-lg border-border-light dark:border-gray-600 shadow-sm p-3 focus:border-primary focus:ring-primary bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark" required>
                </div>
                <p id="auth-error" class="text-sm text-red-600 h-4"></p>
                <button type="submit" id="auth-submit-btn" class="w-full py-3 px-4 bg-primary text-white font-semibold rounded-xl shadow-md hover:bg-primary/90 transition duration-150">
                    ${isLogin ? 'Log In' : 'Sign Up'}
                </button>
            </form>
            <div class="mt-6">${switchLink}</div>
        </div>
    `;
};

const renderAccount = () => {
    const userStatus = currentUser ? 'Authenticated' : 'Not Logged In';

    document.getElementById('content-area').innerHTML = `
        <h2 class="text-2xl font-bold text-text-light dark:text-text-dark mb-6 md:text-3xl px-4 pt-4">Account Profile</h2>
        
        <div class="flex flex-col items-center bg-white dark:bg-container-dark p-6 rounded-xl shadow-lg border border-border-light dark:border-gray-700 mb-8 max-w-lg mx-auto">
            <div class="w-20 h-20 bg-primary/80 rounded-full flex items-center justify-center text-white text-3xl font-bold mb-3">${currentUser?.email ? currentUser.email[0].toUpperCase() : 'G'}</div>
            <p class="text-lg font-bold text-text-light dark:text-text-dark">${currentUser?.email || 'Guest User'}</p>
            <p class="text-sm text-text-secondary dark:text-gray-400">Status: ${userStatus}</p>
            <p class="text-xs font-mono text-gray-400 mt-2 break-all px-4 text-center">User ID: ${currentUser?.userId || 'N/A'}</p>
        </div>
        
        <div class="space-y-3 max-w-lg mx-auto p-4">
            <button onclick="navigate('MyOrders')" class="flex items-center justify-between w-full p-4 bg-gray-50 dark:bg-slate-800 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 transition duration-150">
                <span class="flex items-center space-x-3"><span class="material-symbols-outlined text-primary">list_alt</span> <span class="text-base font-medium text-text-light dark:text-text-dark">My Orders</span></span>
                <span class="material-symbols-outlined text-gray-500">chevron_right</span>
            </button>
            <button onclick="navigate('Cart')" class="flex items-center justify-between w-full p-4 bg-gray-50 dark:bg-slate-800 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 transition duration-150">
                <span class="flex items-center space-x-3"><span class="material-symbols-outlined text-primary">shopping_cart</span> <span class="text-base font-medium text-text-light dark:text-text-dark">View Cart</span></span>
                <span class="material-symbols-outlined text-gray-500">chevron_right</span>
            </button>
            <button onclick="navigate('Products')" class="flex items-center justify-between w-full p-4 bg-gray-50 dark:bg-slate-800 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 transition duration-150">
                <span class="flex items-center space-x-3"><span class="material-symbols-outlined text-primary">category</span> <span class="text-base font-medium text-text-light dark:text-text-dark">Browse Products</span></span>
                <span class="material-symbols-outlined text-gray-500">chevron_right</span>
            </button>
            
            ${currentUser ? `
                <hr class="border-border-light dark:border-gray-700 my-4">
                <button onclick="logoutUser()" class="flex items-center justify-center w-full p-4 text-white bg-destructive rounded-xl hover:bg-destructive/90 transition duration-150 space-x-3">
                    <span class="material-symbols-outlined">logout</span>
                    <span class="text-base font-semibold">Log Out</span>
                </button>
            ` : `
                <hr class="border-border-light dark:border-gray-700 my-4">
                <button onclick="navigate('Login')" class="flex items-center justify-center w-full p-4 text-white bg-primary rounded-xl hover:bg-primary/90 transition duration-150 space-x-3">
                    <span class="material-symbols-outlined">login</span>
                    <span class="text-base font-semibold">Log In / Sign Up</span>
                </button>
            `}
        </div>
    `;
};

const renderSearch = () => {
    document.getElementById('content-area').innerHTML = `
        <h2 class="text-2xl font-bold text-text-light dark:text-text-dark mb-4 md:text-3xl px-4 pt-4">Search Products</h2>
        <div class="mb-6 max-w-xl mx-auto px-4">
            <input type="text" id="search-input" oninput="performSearch(this.value)" placeholder="Search for Laptops, iPhone 15, Airpods..." class="w-full p-3 rounded-xl border border-border-light dark:border-gray-600 focus:ring-primary focus:border-primary bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark shadow-sm">
        </div>
        <div id="search-results" class="product-grid-home">
            <p class="col-span-full text-center text-gray-500 py-10">Start typing to see results...</p>
        </div>
    `;
};
 
window.performSearch = (query) => {
    const resultsContainer = document.getElementById('search-results');
    const normalizedQuery = query.toLowerCase().trim();

    if (normalizedQuery.length < 2) {
        resultsContainer.innerHTML = '<p class="col-span-full text-center text-gray-500 py-10">Start typing to see results...</p>';
        return;
    }

    const results = PRODUCT_CATALOG.filter(p => 
        p.name.toLowerCase().includes(normalizedQuery) || 
        p.category.toLowerCase().includes(normalizedQuery)
    );

    if (results.length === 0) {
        resultsContainer.innerHTML = '<p class="col-span-full text-center text-gray-500 py-10">No products found matching your search.</p>';
    } else {
        resultsContainer.innerHTML = renderProductCards(results);
    }
};
 
// --- CHATBOT FUNCTIONALITY ---
 
let isChatOpen = false;
let isDragging = false;
let dragOffset = { x: 0, y: 0 };
 
const chatbotWidget = document.getElementById('chatbot-widget');
const chatbotIcon = document.getElementById('chatbot-icon');
const chatbotWindow = document.getElementById('chatbot-window');
const closeChatbot = document.getElementById('close-chatbot');
const chatbotMessages = document.getElementById('chatbot-messages');
const chatbotInput = document.getElementById('chatbot-input');
const sendMessageBtn = document.getElementById('send-message');
 
const initChatbot = () => {
    const icon = document.getElementById('chatbot-icon');
    const close = document.getElementById('close-chatbot');
    const send = document.getElementById('send-message');
    const input = document.getElementById('chatbot-input');

    if (icon) icon.addEventListener('click', toggleChatbot);
    if (close) close.addEventListener('click', toggleChatbot);
    if (send) send.addEventListener('click', handleSendMessage);
    if (input) input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSendMessage();
    });
    
    makeChatbotDraggable();
};
 
const toggleChatbot = () => {
    const win = document.getElementById('chatbot-window');
    const input = document.getElementById('chatbot-input');
    if (!win) return;

    isChatOpen = !isChatOpen;
    win.style.display = isChatOpen ? 'flex' : 'none';
    
    if (isChatOpen && input) {
        setTimeout(() => { input.focus(); }, 100);
    }
};
 
const handleSendMessage = () => {
    const input = document.getElementById('chatbot-input');
    if (!input) return;
    
    const message = input.value.trim();
    if (!message) return;
    
    addMessage(message, 'user');
    input.value = '';
    showTypingIndicator();
    
    setTimeout(() => {
        removeTypingIndicator();
        const aiResponse = handleUserQuery(message);
        addMessage(aiResponse, 'bot');
    }, 1000);
};
 
const addMessage = (text, sender) => {
    const messagesContainer = document.getElementById('chatbot-messages');
    if (!messagesContainer) return;

    const messageElement = document.createElement('div');
    messageElement.classList.add('message', `${sender}-message`);
    messageElement.textContent = text;
    messagesContainer.appendChild(messageElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
};
 
const showTypingIndicator = () => {
    const messagesContainer = document.getElementById('chatbot-messages');
    if (!messagesContainer) return;

    const typingElement = document.createElement('div');
    typingElement.classList.add('typing-indicator');
    typingElement.id = 'typing-indicator';
    typingElement.innerHTML = `<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>`;
    messagesContainer.appendChild(typingElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
};
 
const removeTypingIndicator = () => {
    const typingElement = document.getElementById('typing-indicator');
    if (typingElement) typingElement.remove();
};
 
// --- ENHANCED CHATBOT QUERY HANDLER ---
const handleUserQuery = (query) => {
    const lowerQuery = query.toLowerCase();

    // 1. Farewell
    if (lowerQuery.includes('bye') || lowerQuery.includes('goodbye')) {
        return "Thank you! Is there anything else I can assist you with?";
    }

    // 2. Product Inquiry: Check if any product name is mentioned
    const productMatch = PRODUCT_CATALOG.find(p => lowerQuery.includes(p.name.toLowerCase()));
    if (productMatch) {
        return `We have the **${productMatch.name}** available for **$${productMatch.price}**. It features ${productMatch.specs.join(', ')}. ${productMatch.description}`;
    }
    
    // Generic product check (e.g. "iphone", "samsung")
    if (lowerQuery.includes('iphone')) {
         const iphone = PRODUCT_CATALOG.find(p => p.name.toLowerCase().includes('iphone'));
         if(iphone) return `We have the **${iphone.name}** available for **$${iphone.price}**. It features ${iphone.specs.join(', ')}. ${iphone.description}`;
    }

    // 3. Navigation / Help Options
    if (lowerQuery.includes('cancel') || lowerQuery.includes('cancellation')) {
        return "To cancel an order, please go to the **'My Orders'** page, find the order you wish to cancel, and click the **'Cancel'** button. Please note: You can only cancel an order within the first minute of placing it.";
    }
    if (lowerQuery.includes('track') || lowerQuery.includes('status')) {
        return "To track your order, navigate to the **'My Orders'** page and click the **'Track Order'** button on the specific order card to see its delivery timeline.";
    }
    if (lowerQuery.includes('cart')) {
        return "You can view your cart by clicking the shopping cart icon in the top right corner. There you can modify quantities or remove items before proceeding to checkout.";
    }
    if (lowerQuery.includes('checkout') || lowerQuery.includes('buy')) {
         return "To buy items, first add them to your cart. Then, go to your Cart page and click the **'Proceed to Checkout'** button. You will need to be logged in to complete your purchase.";
    }
     if (lowerQuery.includes('login') || lowerQuery.includes('sign up') || lowerQuery.includes('account')) {
         return "You can access your account, login, or sign up by clicking the profile icon in the top right corner.";
    }

    // Default Fallback
    return `🤖 Thank you for your inquiry! As an important feature of this website, I am here to assist with any detailed questions you have. For the query: '${query}', here is my detailed answer... DruvCart is your premier destination for the latest electronics and gadgets. We offer a wide range of products including smartphones, laptops, audio devices, and wearables from top brands. Our platform provides secure shopping, fast delivery, and excellent customer support to ensure you have the best shopping experience possible.`;
};
 
const makeChatbotDraggable = () => {
    const icon = document.getElementById('chatbot-icon');
    const widget = document.getElementById('chatbot-widget');
    if (!icon || !widget) return;

    icon.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', stopDrag);
    
    // Mobile drag support
    icon.addEventListener('touchstart', startDragTouch, {passive: false});
    document.addEventListener('touchmove', dragTouch, {passive: false});
    document.addEventListener('touchend', stopDrag);
    
    function startDrag(e) {
        isDragging = true;
        const rect = widget.getBoundingClientRect();
        dragOffset.x = e.clientX - rect.left;
        dragOffset.y = e.clientY - rect.top;
        icon.style.cursor = 'grabbing';
    }
    
    function startDragTouch(e) {
        isDragging = true;
        const touch = e.touches[0];
        const rect = widget.getBoundingClientRect();
        dragOffset.x = touch.clientX - rect.left;
        dragOffset.y = touch.clientY - rect.top;
        // e.preventDefault(); // Removed to allow scrolling if needed
    }
    
    function drag(e) {
        if (!isDragging) return;
        e.preventDefault();
        updatePosition(e.clientX, e.clientY);
    }
    
    function dragTouch(e) {
        if (!isDragging) return;
        const touch = e.touches[0];
        e.preventDefault(); // Prevent scrolling while dragging
        updatePosition(touch.clientX, touch.clientY);
    }
    
    function stopDrag() {
        isDragging = false;
        icon.style.cursor = 'grab';
    }
    
    function updatePosition(x, y) {
        const newX = x - dragOffset.x;
        const newY = y - dragOffset.y;
        const maxX = window.innerWidth - icon.offsetWidth;
        const maxY = window.innerHeight - icon.offsetHeight;
        
        const boundedX = Math.max(0, Math.min(newX, maxX));
        const boundedY = Math.max(0, Math.min(newY, maxY));
        
        widget.style.left = `${boundedX}px`;
        widget.style.top = `${boundedY}px`;
        widget.style.right = 'auto';
        widget.style.bottom = 'auto';
    }
};
 
// --- INITIALIZATION ---
window.onload = async () => {
    await initAuth();
    initChatbot();
};