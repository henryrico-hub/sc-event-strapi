// config/plugins.js

module.exports = ({ env }) => ({
  upload: {
    config: {
      provider: env("NODE_ENV") === "production" ? "cloudinary" : "local",
      providerOptions:
        env("NODE_ENV") === "production"
          ? {
              cloud_name: env("CLOUDINARY_NAME"),
              api_key: env("CLOUDINARY_KEY"),
              api_secret: env("CLOUDINARY_SECRET"),
            }
          : {},
    },
  },
});
