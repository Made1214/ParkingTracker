"use client";
import { useState } from "react";
import { CalendarPlus } from "lucide-react";
import { Card } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { ActionForm } from "@/shared/ui/action-form";
import { createEvent } from "../api/actions";
// Explicit UTC-05:00 avoids interpreting a Panama plan in the server's zone.
export function CreateEventForm({ groupId }: { groupId: string }) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  return (
    <Card>
      <span className="tile-icon">
        <CalendarPlus size={20} />
      </span>
      <h2>Arma el próximo plan</h2>
      <p className="muted small">
        Ponle fecha. Tu grupo se encarga de la compañía.
      </p>
      <ActionForm action={createEvent} label="Publicar evento">
        <input name="group_id" type="hidden" value={groupId} />
        <label>
          ¿Qué van a hacer?
          <Input
            name="title"
            required
            maxLength={120}
            placeholder="Una tarde de playa"
          />
        </label>
        <label>
          ¿Dónde?
          <Input
            name="location"
            maxLength={200}
            placeholder="Lugar o punto de encuentro"
          />
        </label>
        <label>
          Inicio · hora de Panamá
          <Input
            type="datetime-local"
            required
            value={start}
            onChange={(event) => setStart(event.target.value)}
          />
        </label>
        <label>
          Fin · hora de Panamá
          <Input
            type="datetime-local"
            required
            min={start}
            value={end}
            onChange={(event) => setEnd(event.target.value)}
          />
        </label>
        <input
          type="hidden"
          name="starts_at"
          value={start ? `${start}:00-05:00` : ""}
        />
        <input
          type="hidden"
          name="ends_at"
          value={end ? `${end}:00-05:00` : ""}
        />
        <label>
          Algo más que deban saber
          <textarea
            className="input"
            name="description"
            rows={3}
            maxLength={5000}
            placeholder="Qué llevar, cómo llegar, ideas…"
          />
        </label>
      </ActionForm>
    </Card>
  );
}
