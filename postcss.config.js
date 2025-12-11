const path = require("path");

module.exports = {
  plugins: {
    tailwindcss: {
      // Explicitly point to the config file so fast-glob always receives the glob patterns.
      config: path.join(__dirname, "tailwind.config.js"),
    },
    autoprefixer: {},
  },
};
