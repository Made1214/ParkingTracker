"use client";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { CalendarPlus } from "lucide-react";
import { Card } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { ActionForm } from "@/shared/ui/action-form";
import { Button } from "@/shared/ui/button";
import { createEvent } from "../api/actions";
// Explicit UTC-05:00 avoids interpreting a Panama plan in the server's zone.
export function CreateEventForm({ groupId }: { groupId: string }) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  return (
    <Card className="create-event-card">
      <div className="card-header-inline">
        <span className="tile-icon">
          <CalendarPlus size={19} />
        </span>
        <div>
          <h2>Arma el próximo plan</h2>
          <p className="muted small">
            Ponle fecha. Tu grupo se encarga de la compañía.
          </p>
        </div>
      </div>
      <ActionForm
        action={createEvent}
        label="Publicar evento"
        secondary={<DraftButton />}
      >
        <input name="group_id" type="hidden" value={groupId} />
        <label>
          ¿Qué van a hacer?
          <Input
            name="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            maxLength={120}
            placeholder="Una tarde de playa"
          />
        </label>
        <label>
          ¿Dónde?
          <Input
            name="location"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            maxLength={200}
            placeholder="Lugar o punto de encuentro"
          />
        </label>
        <div className="date-field-grid">
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
        </div>
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
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            maxLength={5000}
            placeholder="Qué llevar, cómo llegar, ideas…"
          />
        </label>
        <p className="small muted">
          Los borradores son visibles para los miembros del grupo.
        </p>
      </ActionForm>
    </Card>
  );
}

function DraftButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      name="status"
      value="draft"
      variant="outline"
      disabled={pending}
    >
      Guardar borrador
    </Button>
  );
}
