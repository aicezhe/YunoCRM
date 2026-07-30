"use server";

import { getSegmentProspects, type Segment, type SegmentReport } from "./segment-queries";

export async function loadSegment(segment: Segment): Promise<SegmentReport> {
  return getSegmentProspects(segment);
}
