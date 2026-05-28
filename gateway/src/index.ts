import "dotenv/config";
import app from "./app";

const PORT = parseInt(process.env.GATEWAY_PORT ?? "3000", 10);

app.listen(PORT, () => {
  console.log(`[gateway] running on port ${PORT}`);
});
