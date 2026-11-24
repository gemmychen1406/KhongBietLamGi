export interface Contribution {
  createdAt?: string;
  updatedAt?: string;
  updatedBy?: string;
  updatedByName?: string;
  revision?: number;
  systemSeedKey?: string;
  createdBy?: string;
  contributorName?: string;
}
export type ResourceType = "text" | "image" | "link" | "music_sheet";
export interface Resource extends Contribution {
  id: string;
  type: ResourceType;
  title: string;
  url?: string;
  content?: string;
}
export interface Variant extends Contribution {
  id: string;
  title: string;
  description?: string;
  resources: Resource[];
}
export interface ActivityNode extends Contribution {
  id: string;
  title: string;
  description?: string;
  kind: "group" | "activity";
  enabled: boolean;
  children: ActivityNode[];
  variants: Variant[];
  resources: Resource[];
}
export interface PathItem {
  id: string;
  title: string;
}
export interface Result {
  source?: "sample" | "community";
  path: PathItem[];
  activity: ActivityNode;
  variant?: Variant;
}
export interface HistoryEntry {
  id: string;
  createdAt: string;
  completed: boolean;
  result: Result;
}
export interface AppDocument {
  schemaVersion: 1;
  nodes: ActivityNode[];
  history: HistoryEntry[];
  settings: { autoSaveHistory: true };
}
