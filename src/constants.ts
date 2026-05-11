export const APP_NAME = "GeoSport Live";
export const APP_DESCRIPTION = "პროფესიონალური სპორტული ტრანსლაციების პლატფორმა";

export enum StreamStatus {
  SCHEDULED = "scheduled",
  LIVE = "live",
  ENDED = "ended"
}

export interface Stream {
  id: string;
  created_at: string;
  title: string;
  description: string;
  category: string;
  status: StreamStatus;
  start_time: string;
  peer_id?: string;    // Direct PeerJS ID for WebRTC
  admin_id: string;
  viewers_count: number;
  thumbnail_url?: string;
  stream_url?: string; // Optional HLS or External URL
}

export const CATEGORIES = [
  "ფეხბურთი",
  "კალათბურთი",
  "რაგბი",
  "ჩოგბურთი",
  "ჭიდაობა",
  "ძიუდო",
  "სხვა"
];
