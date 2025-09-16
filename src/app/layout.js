import "./globals.css";

// TODO: Update metadata with actual demo details
export const metadata = {
  title: "Demo Template",
  description: "Industry Solutions Demo Template for NextJS",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
