import { Link } from "react-router";
import { PageHeader } from "@/components/satark/page";

export default function NotFound() {
  return (
    <PageHeader title="Nothing at this address" description={<>The page may have moved. <Link to="/" className="text-signal underline">Go to the overview</Link>.</>} />
  );
}
