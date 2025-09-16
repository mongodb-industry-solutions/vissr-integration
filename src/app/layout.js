import "./globals.css";
import { Providers } from "./providers";

export const metadata = {
  title: "VISS WebSocket Client",
  description:
    "WebSocket client for connecting to VISS (Vehicle Information Service Specification) servers and sending vehicle data commands",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
