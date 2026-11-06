"use client";
import { useState } from "react";
import { ActionForm } from "@/shared/ui/action-form";
import { Input } from "@/shared/ui/input";
import { updateGroup } from "../api/manage-actions";
export function GroupDetailsForm({
  group,
}: {
  group: { id: string; name: string; description: string | null };
}) {
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description ?? "");
  return (
    <ActionForm action={updateGroup} label="Guardar grupo">
      <input type="hidden" name="group_id" value={group.id} />
      <label>
        Nombre
        <Input
          name="name"
          required
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label>
        Descripción
        <textarea
          className="input"
          name="description"
          rows={4}
          maxLength={2000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
    </ActionForm>
  );
}
