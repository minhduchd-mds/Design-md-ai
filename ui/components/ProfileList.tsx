import { useState } from "react";
import type { PluginProfile } from "../../shared/types";
import { EditIcon } from "./EditIcon";
import { DeleteIcon } from "./DeleteIcon";
import styles from "./ProfileList.module.css";

interface ProfileListProps {
  profiles: PluginProfile[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
  onEdit: (profile: PluginProfile) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}

export function ProfileList({ profiles, activeId, onSelect, onEdit, onDelete, onNew }: ProfileListProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  return (
    <div className={styles.root}>
      <div className={styles.selectorHeader}>
        <span className={styles.selectorLabel}>Design System Profiles</span>
        <button className="btn-link" onClick={onNew}>
          + New
        </button>
      </div>

      {profiles.length === 0 ? (
        <div className={styles.empty}>
          No profiles yet.
        </div>
      ) : (
        <div className={styles.list}>
          <button className={`${styles.item} ${activeId === null ? styles.itemActive : ""}`} onClick={() => onSelect(null)}>
            <span className={styles.itemName}>Generic (no profile)</span>
          </button>
          {profiles.map((p) => (
            <div
              key={p.id}
              className={`${styles.item} ${activeId === p.id ? styles.itemActive : ""} ${confirmDeleteId === p.id ? styles.itemConfirm : ""}`}
            >
              <button className={styles.itemBtn} onClick={() => confirmDeleteId === p.id ? undefined : onSelect(p.id)}>
                <span className={styles.itemName}>{p.name}</span>
                <span className={styles.itemStack}>{p.stack}</span>
              </button>
              {confirmDeleteId === p.id ? (
                <div className={styles.confirmActions}>
                  <button className="btn-link" onClick={() => setConfirmDeleteId(null)}>
                    Cancel
                  </button>
                  <button
                    className={styles.confirmDeleteBtn}
                    onClick={() => {
                      setConfirmDeleteId(null);
                      onDelete(p.id);
                    }}
                  >
                    Delete
                  </button>
                </div>
              ) : (
                <div className={styles.itemActions}>
                  <button className="btn-icon" onClick={() => onEdit(p)} title="Edit">
                    <EditIcon size={16} />
                  </button>
                  <button className="btn-icon btn-icon-danger" onClick={() => setConfirmDeleteId(p.id)} title="Delete">
                    <DeleteIcon size={16} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
