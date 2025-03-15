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