import { Card } from "@/shared/ui/card";
import { deletePhoto, uploadPhoto } from "../api/actions";
import { getPhotos } from "../api/queries";
import { PhotoGallery } from "./photo-gallery";
import styles from "./gallery.module.css";

const megabytes = (bytes: number) => `${(bytes / 1048576).toFixed(1)} MB`;

export async function GalleryPanel({
  groupId,
  eventId,
}: {
  groupId: string;
  eventId: string;
}) {
  const data = await getPhotos(groupId, eventId);
  const used = Math.min(100, (data.usedBytes / data.quotaBytes) * 100);
  return (
    <Card className={styles.panel} aria-labelledby="gallery-title">
      <div className={styles.heading}>
        <div>
          <h2 id="gallery-title">Fotos</h2>
          <p className="small muted">
            {data.photos.length}{" "}
            {data.photos.length === 1 ? "recuerdo" : "recuerdos"} · solo
            visibles para el grupo
          </p>
        </div>
        <div className={styles.quota}>
          <span className="small muted">
            {megabytes(data.usedBytes)} de {megabytes(data.quotaBytes)} del
            grupo
          </span>
          <span className={styles.bar} aria-hidden="true">
            <span style={{ width: `${used}%` }} />
          </span>
        </div>
      </div>
      <PhotoGallery
        groupId={groupId}
        eventId={eventId}
        photos={data.photos}
        canUpload={data.canUpload}
        uploadAction={uploadPhoto}
        deleteAction={deletePhoto}
      />
    </Card>
  );
}
