function registerHealthRoutes(app, context) {
  app.get("/api/health", async (_req, res) => {
    try {
      const mongoState = context.getDatabaseState();
      const blockchainState = await context.getBlockchainState();
      const data = {
        status: "ok",
        platform: "ethereum",
        ...blockchainState,
        databaseReady: mongoState.ready,
      };
      res.json({ ok: true, data });
    } catch (error) {
      res.status(503).json({ ok: false, error: error.message });
    }
  });
}

module.exports = { registerHealthRoutes };
