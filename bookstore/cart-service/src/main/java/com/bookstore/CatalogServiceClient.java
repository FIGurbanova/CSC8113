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