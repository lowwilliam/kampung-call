import { ReceiptPortal } from "../../components/ReceiptPortal";

export default async function ReceiptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ReceiptPortal token={token} />;
}
