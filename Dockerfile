# Usar imagem oficial do Node.js baseada em Debian (evita problemas com bibliotecas nativas)
FROM node:18-slim

# Criar e definir o diretório de trabalho
WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar dependências da aplicação
RUN npm install

# Copiar todo o código-fonte para dentro do container
COPY . .

# Criar pastas necessárias caso não existam no repositório
RUN mkdir -p uploads data

# O Render injeta a porta via process.env.PORT, mas expomos a 3000 por padrão
EXPOSE 3000

# Comando para iniciar o servidor
CMD ["node", "server.js"]