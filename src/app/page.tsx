"use client";

import { useEffect, useRef, useState } from "react";

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pixelData, setPixelData] = useState<string[][]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [gridCols, setGridCols] = useState(80);
  const [gridRows, setGridRows] = useState(60);

  // ASCII characters from lightest to darkest - with select numbers and letters
  const getAsciiChar = (intensity: number): string => {
    const chars = " .:-=+io*xXO678qg#MW%@";
    const index = Math.floor((intensity / 255) * (chars.length - 1));
    return chars[index];
  };

  useEffect(() => {
    console.log("Component mounting...");
    setIsMounted(true);

    // Calculate grid dimensions based on screen size for 16px font
    const calculateGridDimensions = () => {
      if (typeof window !== 'undefined') {
        // Character dimensions for 16px monospace font
        const charWidth = 9.6; // Approximate width of monospace character at 16px
        const charHeight = 16; // Line height for 16px font

        const cols = Math.floor(window.innerWidth / charWidth);
        const rows = Math.floor(window.innerHeight / charHeight);

        setGridCols(cols);
        setGridRows(rows);

        console.log(`Grid dimensions: ${cols} cols x ${rows} rows`);
      }
    };

    calculateGridDimensions();
    window.addEventListener('resize', calculateGridDimensions);

    return () => {
      window.removeEventListener('resize', calculateGridDimensions);
    };
  }, []);

  useEffect(() => {
    const startCamera = async () => {
      try {
        console.log("Starting camera...");
        
        // Wait for video element to be available
        if (!videoRef.current) {
          console.log("Video element not ready yet, waiting...");
          setTimeout(() => {
            if (isMounted) startCamera();
          }, 100);
          return;
        }

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Camera not supported in this browser");
        }

        console.log("Requesting camera access...");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240 }
        });
        console.log("Camera stream obtained:", stream);
        console.log("Setting video srcObject...");
        
        videoRef.current.srcObject = stream;
        videoRef.current.load();
        
        console.log("Video element setup complete, starting playback...");
        
        const handleCanPlay = () => {
          console.log("Video can play - setting loading to false");
          setIsLoading(false);
          setError(null);
        };

        videoRef.current.addEventListener('canplay', handleCanPlay);
        
        try {
          await videoRef.current.play();
          console.log("Video is playing");
          // Fallback in case canplay doesn't fire
          setTimeout(() => {
            if (isLoading) {
              console.log("Fallback: setting loading to false");
              setIsLoading(false);
            }
          }, 1000);
        } catch (playError: any) {
          console.error("Play error:", playError);
          // Still try to show the feed
          setIsLoading(false);
        }

      } catch (error: any) {
        console.error("Error accessing camera:", error);
        setError(`Camera error: ${error.message}`);
        setIsLoading(false);
      }
    };

    if (isMounted) {
      startCamera();
    }

    return () => {
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isMounted]); // Removed isLoading dependency to prevent loops

  useEffect(() => {
    console.log("Frame processing effect triggered, isLoading:", isLoading, "isMounted:", isMounted);
    
    const processFrame = () => {
      console.log("processFrame called");
      
      if (!videoRef.current || !canvasRef.current) {
        console.log("Missing refs - video:", !!videoRef.current, "canvas:", !!canvasRef.current);
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      console.log("Video dimensions:", video.videoWidth, "x", video.videoHeight);
      console.log("Video paused:", video.paused, "currentTime:", video.currentTime);

      if (!ctx || video.videoWidth === 0) {
        console.log("No context or zero video width - ctx:", !!ctx, "videoWidth:", video.videoWidth);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      console.log("Drawing to canvas...");
      // Flip the canvas horizontally to mirror the image
      ctx.scale(-1, 1);
      ctx.drawImage(video, -canvas.width, 0);
      ctx.scale(-1, 1); // Reset scale

      console.log("Getting image data...");
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      console.log("Image data length:", data.length);

      const pixels: string[][] = [];

      // Sample pixels to match our calculated grid dimensions
      const stepX = canvas.width / gridCols;
      const stepY = canvas.height / gridRows;

      for (let row = 0; row < gridRows; row++) {
        const pixelRow: string[] = [];
        for (let col = 0; col < gridCols; col++) {
          const x = Math.floor(col * stepX);
          const y = Math.floor(row * stepY);
          const index = (y * canvas.width + x) * 4;
          const r = data[index] || 0;
          const g = data[index + 1] || 0;
          const b = data[index + 2] || 0;
          const intensity = Math.round((r + g + b) / 3);

          const char = getAsciiChar(intensity);
          pixelRow.push(char);
        }
        pixels.push(pixelRow);
      }

      console.log("Processed pixels array:", pixels.length, "rows x", pixels[0]?.length, "cols");
      console.log("Sample pixel values:", pixels[0]?.slice(0, 5));
      setPixelData(pixels);
      
      console.log("Requesting next frame...");
      // Throttle to ~30 FPS for better performance
      setTimeout(() => requestAnimationFrame(processFrame), 33);
    };

    if (!isLoading && isMounted) {
      console.log("Starting frame processing timer...");
      const timer = setTimeout(() => {
        console.log("Timer fired, calling processFrame");
        processFrame();
      }, 100);

      return () => {
        console.log("Cleaning up timer");
        clearTimeout(timer);
      };
    } else {
      console.log("Not starting frame processing - isLoading:", isLoading, "isMounted:", isMounted);
    }
  }, [isLoading, isMounted]);

  if (!isMounted) {
    return (
      <div className="w-screen h-screen bg-black flex items-center justify-center text-white text-xl">
        <video ref={videoRef} className="hidden" autoPlay muted playsInline />
        <canvas ref={canvasRef} className="hidden" />
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-screen h-screen bg-black flex items-center justify-center text-white text-xl text-center p-4">
        <video ref={videoRef} className="hidden" autoPlay muted playsInline />
        <canvas ref={canvasRef} className="hidden" />
        <div>
          <div className="mb-4">Camera Error:</div>
          <div className="text-red-400 text-lg">{error}</div>
          <div className="mt-4 text-sm text-gray-400">
            Make sure to allow camera permissions in your browser
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="w-screen h-screen bg-black flex items-center justify-center text-white text-xl">
        <video ref={videoRef} className="hidden" autoPlay muted playsInline />
        <canvas ref={canvasRef} className="hidden" />
        Loading camera...
      </div>
    );
  }

  return (
    <div className="w-screen h-screen bg-black overflow-hidden">
      <video ref={videoRef} className="hidden" autoPlay muted playsInline />
      <canvas ref={canvasRef} className="hidden" />

      {pixelData.length > 0 ? (
        <pre
          className="fixed top-0 left-0 font-mono bg-black text-white overflow-hidden"
          style={{
            width: '100vw',
            height: '100vh',
            margin: 0,
            padding: 0,
            lineHeight: '1',
            fontSize: '16px',
            letterSpacing: '0',
            whiteSpace: 'pre',
            display: 'block',
            zIndex: 1,
          }}
        >
          {pixelData.map((row) => row.join('') + '\n').join('')}
        </pre>
      ) : (
        <div className="w-full h-full flex items-center justify-center text-white">
          <div className="text-center">
            <div>Camera started but no pixel data yet...</div>
            <div className="text-sm mt-2 text-gray-400">
              isLoading: {isLoading.toString()}<br/>
              isMounted: {isMounted.toString()}<br/>
              pixelData length: {pixelData.length}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
