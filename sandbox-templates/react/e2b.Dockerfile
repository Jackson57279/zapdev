# You can use most Debian-based base images
FROM node:21-slim

# Install curl
RUN apt-get update && apt-get install -y curl && apt-get clean && rm -rf /var/lib/apt/lists/*

# Update npm to latest version and install pnpm
RUN npm install -g npm@latest pnpm@latest

# Install dependencies and customize sandbox
WORKDIR /home/user

# Create React app with Vite
RUN npm create vite@latest react-app -- --template react-ts

# Move into the app directory
WORKDIR /home/user/react-app

# Install dependencies
RUN npm install

# Install Chakra UI and Tailwind CSS
RUN npm install @chakra-ui/react @emotion/react @emotion/styled framer-motion
RUN npm install -D tailwindcss postcss autoprefixer

# Configure Tailwind
RUN cat <<'EOF' > tailwind.config.js
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: { extend: {} },
  plugins: [],
};
EOF

RUN cat <<'EOF' > postcss.config.js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
EOF

# Add Tailwind directives to index.css
RUN echo '@tailwind base;\n@tailwind components;\n@tailwind utilities;' > src/index.css

# Move the React app to the home directory
RUN mv /home/user/react-app/* /home/user/ && rm -rf /home/user/react-app

# Set working directory
WORKDIR /home/user

# Start dev server on port 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
