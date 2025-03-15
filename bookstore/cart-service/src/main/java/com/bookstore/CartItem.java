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