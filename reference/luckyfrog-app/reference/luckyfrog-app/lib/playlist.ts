interface Song {
  artist: string;
  name: string;
  path: string;
}

const song_list: Song[] = [
  {
    artist: "Lucky Frog",
    name: "Calm",
    path: "/audio/calm_background.mp3",
  },
];

export const getSong = (index: number): Song => {
  return song_list[index];
};

export const getSongCount = (): number => {
  return song_list.length;
};
