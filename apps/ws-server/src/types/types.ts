export interface Group {
  startTime: number | null;
  members: {
    id: string;
    institutionId: string;
  }[];
}
