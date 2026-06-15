"use client";

import { useParams } from "next/navigation";
import { JoinFlow } from "../../../components/JoinFlow";

export default function JoinByLinkPage() {
  const { code } = useParams<{ code: string }>();
  return <JoinFlow initialCode={code} />;
}
