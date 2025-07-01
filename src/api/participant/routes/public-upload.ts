module.exports = {
  routes: [
    {
      method: "POST",
      path: "/public-upload/receipt",
      handler: "public-upload.uploadReceipt",
      config: {
        auth: false,
        policies: [],
      },
    },
  ],
};
