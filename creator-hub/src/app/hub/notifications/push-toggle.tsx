"use client";
import { useState } from "react";

function b64ToUint8(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function PushToggle({ publicKey }: { publicKey: string | null }) {
  const [msg, setMsg] = useState<string | null>(null);
  if (!publicKey) return <span className="btn btn-ghost cursor-default opacity-60" title="Configurer NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT">Push : non configuré</span>;
  return (
    <button className="btn btn-ghost" onClick={async () => {
      try {
        if (!("serviceWorker" in navigator) || !("PushManager" in window)) return setMsg("Navigateur non compatible");
        const perm = await Notification.requestPermission();
        if (perm !== "granted") return setMsg("Permission refusée");
        const reg = await navigator.serviceWorker.register("/sw.js");
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(publicKey) });
        const r = await fetch("/api/hub/push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(sub) });
        setMsg(r.ok ? "Push activé ✓" : "Erreur d'enregistrement");
      } catch (e) { setMsg("Erreur : " + (e as Error).message); }
    }}>{msg ?? "Activer les notifications push"}</button>
  );
}
