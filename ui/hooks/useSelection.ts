import { useState, useEffect, useCallback } from "react";
import type { SerializedNode } from "../../shared/types";

export function useSelection() {
  const [selectedNode, setSelectedNode] = useState<SerializedNode | null>(null);
  const [selectionName, setSelectionName] = useState("");
  const [selectionCount, setSelectionCount] = useState(0);
  const [resolvedFromComponentSet, setResolvedFromComponentSet] = useState(false);
  const [componentSetName, setComponentSetName] = useState("");

  useEffect(() => {
    parent.postMessage({ pluginMessage: { type: "request-selection" } }, "*");
  }, []);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const msg = event.data?.pluginMessage;
      if (!msg) return;
      if (msg.type === "selection-change") {
        setSelectedNode(msg.node);
        setSelectionName(msg.name);
        setSelectionCount(msg.selectionCount ?? 1);
        setResolvedFromComponentSet(msg.resolvedFromComponentSet ?? false);
        setComponentSetName(msg.componentSetName ?? "");
      } else if (msg.type === "no-selection") {
        setSelectedNode(null);
        setSelectionName("");
        setSelectionCount(0);
        setResolvedFromComponentSet(false);
        setComponentSetName("");
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const refreshSelection = useCallback(() => {
    parent.postMessage({ pluginMessage: { type: "request-selection" } }, "*");
  }, []);

  return { selectedNode, selectionName, selectionCount, resolvedFromComponentSet, componentSetName, refreshSelection };
}
