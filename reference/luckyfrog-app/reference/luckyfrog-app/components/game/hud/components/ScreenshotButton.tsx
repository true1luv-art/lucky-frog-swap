import React, { useState } from "react";
import html2canvas from "html2canvas";

const screenshotIcon = "/assets/icons/screenshot-icon.png";

import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";

export const ScreenshotButton: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [ssImg,  setSSImg]  = useState("");

  const handleTweetClick = () => {
    window.open(
      "https://twitter.com/intent/tweet?text=Check%20out%20my%20Lucky%20Frog%20Farm!&hashtags=LuckyFrog",
      "_blank"
    );
  };

  const downloadImage = (content: string, name = "My LuckyFrog Farm", type = "jpeg") => {
    const link = document.createElement("a");
    link.href = `data:application/octet-stream;base64,${encodeURIComponent(content)}`;
    link.download = /\.\w+/.test(name) ? name : `${name}.${type}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveImage = () => downloadImage(ssImg.replace(/^data:image\/\w+;base64,/, ""));

  const getScreenshot = () => {
    html2canvas(document.body).then((canvas) => {
      setSSImg(canvas.toDataURL("image/jpeg"));
      setIsOpen(true);
    });
  };

  return (
    <div className="fixed bottom-44 right-2 z-50 w-10 sm:w-12">
      <Button onClick={getScreenshot} className="p-0">
        <img
          src={typeof screenshotIcon === "string" ? screenshotIcon : (screenshotIcon as { src: string })?.src}
          className="w-fit"
          alt="screenshot"
        />
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setIsOpen(false)}>
          <Panel onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <h1 className="text-sm text-shadow mb-2">Show off to fellow farmers</h1>
            <img src={ssImg} id="ss-image" alt="Farm screenshot" style={{ maxHeight: "40vh" }} />
            <div className="flex gap-2 mt-2 justify-center">
              <Button className="text-s w-1/4 px-1" onClick={handleSaveImage}>Save</Button>
              <Button className="text-s w-1/4 px-1" onClick={handleTweetClick}>Tweet</Button>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
};
