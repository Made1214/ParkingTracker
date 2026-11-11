"use client";
import { useState } from "react";
import type React from "react";
import { Trash2 } from "lucide-react";
import { Input } from "@/shared/ui/input";
import { ActionForm } from "@/shared/ui/action-form";
import { Disclosure } from "@/shared/ui/disclosure";
import { deleteAccount, updateProfile, updateAvatar } from "../api/actions";
import styles from "./profile.module.css";

export function ProfileForm({
  profile,
  children,
}: {
  /** Contenido extra bajo los datos (p. ej. apariencia). */
  children?: React.ReactNode;
  profile: {
    id: string;
    display_name: string;
    username: string | null;
    avatar_public_id: string | null;
    updated_at: string;
  };
}) {
  const [name, setName] = useState(profile.display_name);
  const [username, setUsername] = useState(profile.username ?? "");
  const [failedAvatar, setFailedAvatar] = useState(false);
  return (
    <div className={styles.columns}>
      <div className={styles.stack}>
        <section className="card" aria-labelledby="profile-details">
          <h2 id="profile-details">Cómo te ve tu grupo</h2>
          <ActionForm action={updateProfile} label="Guardar perfil">
            <label>
              Nombre visible
              <Input
                name="display_name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={80}
                autoComplete="name"
              />
            </label>
            <label>
              Nombre de usuario
              <Input
                name="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                minLength={3}
                maxLength={24}
                pattern="[a-zA-Z0-9_]{3,24}"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                aria-describedby="username-help"
              />
            </label>
            <p id="username-help" className="small muted">
              Único en Parking Tracker. De 3 a 24 letras, números o guiones
              bajos; se guarda en minúsculas.
            </p>
          </ActionForm>
        </section>
        {children}
        <Disclosure
          tone="danger"
          icon={<Trash2 size={18} />}
          title="Eliminar cuenta"
          hint="Borra tu perfil y tus imágenes para siempre"
        >
          <p className="small muted">
            Si administras un grupo, otra persona pasará a ser admin; si eras su
            única persona, el grupo se eliminará. Esta acción no se puede
            deshacer. Escribe ELIMINAR para confirmar.
          </p>
          <ActionForm
            action={deleteAccount}
            label="Eliminar mi cuenta"
            tone="danger"
          >
            <label>
              Confirmación
              <Input
                name="confirmation"
                required
                pattern="ELIMINAR"
                placeholder="Escribe ELIMINAR"
                autoComplete="off"
              />
            </label>
          </ActionForm>
        </Disclosure>
      </div>
      <section
        className={`card ${styles.avatarCard}`}
        aria-labelledby="profile-avatar"
      >
        <h2 id="profile-avatar">Tu imagen</h2>
        {profile.avatar_public_id && !failedAvatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className={styles.avatar}
            src={`/api/profiles/${profile.id}/avatar?v=${encodeURIComponent(profile.updated_at)}`}
            alt="Tu imagen de perfil"
            width={112}
            height={112}
            onError={() => setFailedAvatar(true)}
          />
        ) : (
          <span
            className={styles.initials}
            aria-label="Sin imagen personalizada"
          >
            {profile.display_name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <p className="small muted">
          Visible para ti y las personas con las que compartes grupo.
        </p>
        <ActionForm action={updateAvatar} label="Guardar imagen">
          <label>
            Elegir imagen
            <Input
              type="file"
              name="avatar"
              accept="image/jpeg,image/png,image/webp"
              required
            />
          </label>
          <p className="small muted">JPG, PNG o WebP. Máximo 5 MB.</p>
        </ActionForm>
        {profile.avatar_public_id && (
          <ActionForm
            action={updateAvatar}
            label="Eliminar imagen"
            tone="danger"
          >
            <input type="hidden" name="remove" value="true" />
          </ActionForm>
        )}
      </section>
    </div>
  );
}
