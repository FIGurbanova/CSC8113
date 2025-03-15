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
                        .allowedOriginPatterns(
                            "http://localhost",
                            "http://frontend",
                            "http://frontend:80",
                            "http://35.176.187.132",
                            "http://35.176.187.132:80",
                            "http://*.eu-west-2.elb.amazonaws.com",
                            "http://*.eu-west-2.elb.amazonaws.com:80",
                            "*" // 显式添加端口
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