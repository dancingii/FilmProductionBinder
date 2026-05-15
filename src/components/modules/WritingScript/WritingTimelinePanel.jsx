import React from "react";
import WritingTimeline from "../../../experimental/writingTimeline/WritingTimeline";

// Ownership wrapper for the Writing workflow timeline. The implementation
// remains in experimental/writingTimeline until timeline extraction is scoped.
function WritingTimelinePanel(props) {
  return <WritingTimeline {...props} />;
}

export default WritingTimelinePanel;
