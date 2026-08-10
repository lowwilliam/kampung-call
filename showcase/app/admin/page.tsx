import { AdminPortal } from "../components/AdminPortal";

export const metadata = {
  title: "Collection Admin",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <AdminPortal />;
}
