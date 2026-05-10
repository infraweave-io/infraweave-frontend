module.exports = {
  content: [
    "./src/components/TofuGraph/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
  corePlugins: {
    preflight: false, // Disable reset to avoid conflicts with Material UI
  }
}
