import moment from 'moment';

export interface Server {
  name: string;
  url: string;
}

export interface Match {
  id: string;
  title: string;
  team1Name: string;
  team1Logo: string;
  team2Name: string;
  team2Logo: string;
  startTime: string;
  endTime: string;
  categoryName: string;
  isImportant?: boolean;
  order?: number;
  servers: Server[];
}

export interface Channel {
  id: string;
  name: string;
  logoUrl: string;
  streamUrl: string;
  categoryName: string;
}

export interface Highlight {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  videoUrl: string;
  categoryName: string;
}

export interface Category {
  id: string;
  name: string;
}

export interface AppSettings {
  welcomeMessage: string;
  alertTitle: string;
  alertMessage: string;
  telegramLink: string;
  playlists?: { name: string; url: string }[];
}

export interface Banner {
  imageUrl: string;
  targetUrl: string;
}

export interface Banners {
  homeTop: Banner;
  homeBottom: Banner;
  channels: Banner;
  highlights: Banner;
}
