"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Loader2 } from "lucide-react";

export default function IndividualEntryPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleStart = async () => {
    if (!name.trim() || !idNumber.trim()) {
      setError("Please fill in all fields");
      return;
    }

    setLoading(true);
    setError("");

    try {
      router.push(`/individual/quiz?name=${encodeURIComponent(name)}&id=${encodeURIComponent(idNumber)}`);
    } catch (err) {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen water-background relative overflow-hidden flex items-center justify-center">
      {/* Water Background Elements */}
      <div className="water-overlay" />
      <div className="water-drops" />
      <div className="bubbles">
        {[...Array(20)].map((_, i) => (
          <div key={i} className="bubble" style={{
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 3}s`,
            animationDuration: `${4 + Math.random() * 4}s`
          }} />
        ))}
      </div>

      <div className="relative z-10 w-full max-w-md px-4">
        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-gray-700/30 mb-2">Care Clans</h1>
          <p className="text-gray-600">You have 5 minutes to prove your knowledge.</p>
        </div>

        {/* Entry Card */}
        <Card className="bg-white/95 backdrop-blur-sm shadow-2xl border-0">
          <CardHeader className="text-center pb-2">
            <div className="w-16 h-16 bg-cyan-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <User className="w-8 h-8 text-cyan-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800">Enter the Challenge</h2>
            <p className="text-gray-500 text-sm">Fill in your details below to begin.</p>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name" className="text-gray-700">Full Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="Enter your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-white border-gray-200 focus:border-cyan-400 focus:ring-cyan-400"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="idNumber" className="text-gray-700">ID Number</Label>
              <Input
                id="idNumber"
                type="text"
                placeholder="Enter your ID number"
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value)}
                className="bg-white border-gray-200 focus:border-cyan-400 focus:ring-cyan-400"
              />
            </div>

            <Button
              onClick={handleStart}
              disabled={loading}
              className="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-semibold py-6 text-lg"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Starting...
                </>
              ) : (
                "Start Challenge"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      <style jsx>{`
        .water-background {
          background: linear-gradient(180deg, #e0f7fa 0%, #b2ebf2 50%, #80deea 100%);
        }

        .water-overlay {
          position: absolute;
          inset: 0;
          background: 
            radial-gradient(ellipse at 20% 20%, rgba(255, 255, 255, 0.3) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 80%, rgba(255, 255, 255, 0.2) 0%, transparent 50%);
          pointer-events: none;
        }

        .water-drops {
          position: absolute;
          inset: 0;
          background-image: 
            radial-gradient(circle at 10% 10%, rgba(255, 255, 255, 0.8) 2px, transparent 2px),
            radial-gradient(circle at 90% 20%, rgba(255, 255, 255, 0.6) 3px, transparent 3px),
            radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.4) 2px, transparent 2px),
            radial-gradient(circle at 20% 80%, rgba(255, 255, 255, 0.7) 2px, transparent 2px),
            radial-gradient(circle at 80% 70%, rgba(255, 255, 255, 0.5) 3px, transparent 3px);
          animation: shimmer 8s ease-in-out infinite;
          pointer-events: none;
        }

        .bubbles {
          position: absolute;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
        }

        .bubble {
          position: absolute;
          bottom: -20px;
          width: 20px;
          height: 20px;
          background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.8), rgba(255, 255, 255, 0.2));
          border-radius: 50%;
          animation: rise linear infinite;
        }

        @keyframes rise {
          0% {
            transform: translateY(0) scale(1);
            opacity: 0.6;
          }
          100% {
            transform: translateY(-100vh) scale(0.5);
            opacity: 0;
          }
        }

        @keyframes shimmer {
          0%, 100% {
            opacity: 0.5;
          }
          50% {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
