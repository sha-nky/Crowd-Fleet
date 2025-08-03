import { commonrequest } from "./APICall";
import { BACKEND_URL } from "./Helper";

export const testConnection = async () => {
  return await commonrequest("GET", `${BACKEND_URL}/api/sample`);
};
