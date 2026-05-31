"use client";

import { useState } from "react";
import type { MailFolderNode } from "@/types/mail";
import MailFolderItem from "./MailFolderItem";

interface MailFolderTreeProps {
  nodes: MailFolderNode[];
  selectedFolderId: string | null;
  unreadCounts: Record<string, number>;
  onSelectFolder: (folderId: string) => void;
  onDropMessage: (messageId: string, folderId: string) => void;
  onContextAction?: (node: MailFolderNode, action: "rename" | "delete") => void;
}

export default function MailFolderTree({
  nodes,
  selectedFolderId,
  unreadCounts,
  onSelectFolder,
  onDropMessage,
  onContextAction,
}: MailFolderTreeProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggle = (id: string) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const renderNodes = (list: MailFolderNode[]): React.ReactNode =>
    list.map((node) => {
      const hasChildren = node.children.length > 0;
      const isExpanded = expanded[node.id] ?? false;
      return (
        <div key={node.id}>
          <MailFolderItem
            node={node}
            selected={selectedFolderId === node.id}
            unread={unreadCounts[node.id] ?? 0}
            hasChildren={hasChildren}
            expanded={isExpanded}
            onSelect={() => onSelectFolder(node.id)}
            onToggleExpand={() => toggle(node.id)}
            onDropMessage={onDropMessage}
            onContextAction={onContextAction}
          />
          {hasChildren && isExpanded && renderNodes(node.children)}
        </div>
      );
    });

  return <div className="space-y-0.5">{renderNodes(nodes)}</div>;
}
