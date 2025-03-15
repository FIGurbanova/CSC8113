# frontend/Dockerfile
# Stage 1: 构建 React 应用
FROM node:18 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ARG REACT_APP_API_BASE_URL
ARG REACT_APP_ORDER_SERVICE_URL
ENV REACT_APP_API_BASE_URL=$REACT_APP_API_BASE_URL
ENV REACT_APP_ORDER_SERVICE_URL=$REACT_APP_ORDER_SERVICE_URL
RUN npm run build

# Stage 2: 部署到 Nginx
FROM nginx:alpine
# 复制 Nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf
# 复制构建后的静态文件
COPY --from=builder /app/build /usr/share/nginx/html
# 暴露端口
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]