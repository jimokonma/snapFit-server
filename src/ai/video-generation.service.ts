import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface VideoGenerationResult {
  videoUrl: string;
  duration: number;
  quality: string;
  service: string;
}

@Injectable()
export class VideoGenerationService {
  constructor(private configService: ConfigService) {}

  async generateExerciseVideo(exerciseName: string, prompt: string): Promise<VideoGenerationResult> {
    // Try different video generation services in order of preference
    const services = [
      () => this.tryRunwayML(exerciseName, prompt),
      () => this.tryPikaLabs(exerciseName, prompt),
      () => this.tryLumaAI(exerciseName, prompt),
      () => this.tryStableVideo(exerciseName, prompt),
    ];

    for (const service of services) {
      try {
        const result = await service();
        if (result) {
          return result;
        }
      } catch (error) {
        console.log(`Video generation service failed: ${error.message}`);
        continue;
      }
    }

    throw new Error('All video generation services failed');
  }

  private async tryRunwayML(exerciseName: string, prompt: string): Promise<VideoGenerationResult | null> {
    const apiKey = this.configService.get<string>('RUNWAYML_API_KEY');
    if (!apiKey) {
      throw new Error('RunwayML API key not configured');
    }

    // RunwayML API integration
    const response = await fetch('https://api.runwayml.com/v1/image_to_video', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: prompt,
        duration: 10,
        resolution: '1280x720',
        model: 'gen3a_turbo',
      }),
    });

    if (!response.ok) {
      throw new Error(`RunwayML API error: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      videoUrl: data.video_url,
      duration: 10,
      quality: '720p',
      service: 'RunwayML',
    };
  }

  private async tryPikaLabs(exerciseName: string, prompt: string): Promise<VideoGenerationResult | null> {
    const apiKey = this.configService.get<string>('PIKA_API_KEY');
    if (!apiKey) {
      throw new Error('Pika Labs API key not configured');
    }

    // Pika Labs API integration
    const response = await fetch('https://api.pika.art/v1/generate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: prompt,
        duration: 4,
        aspect_ratio: '16:9',
        style: 'realistic',
      }),
    });

    if (!response.ok) {
      throw new Error(`Pika Labs API error: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      videoUrl: data.video_url,
      duration: 4,
      quality: '720p',
      service: 'Pika Labs',
    };
  }

  private async tryLumaAI(exerciseName: string, prompt: string): Promise<VideoGenerationResult | null> {
    const apiKey = this.configService.get<string>('LUMA_API_KEY');
    if (!apiKey) {
      throw new Error('Luma AI API key not configured');
    }

    // Luma AI API integration
    const response = await fetch('https://api.lumalabs.ai/v1/generate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: prompt,
        duration: 5,
        resolution: '1280x720',
      }),
    });

    if (!response.ok) {
      throw new Error(`Luma AI API error: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      videoUrl: data.video_url,
      duration: 5,
      quality: '720p',
      service: 'Luma AI',
    };
  }

  private async tryStableVideo(exerciseName: string, prompt: string): Promise<VideoGenerationResult | null> {
    const apiKey = this.configService.get<string>('STABILITY_API_KEY');
    if (!apiKey) {
      throw new Error('Stability AI API key not configured');
    }

    // Stability AI Stable Video Diffusion
    const response = await fetch('https://api.stability.ai/v2beta/image-to-video', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: '', // You would need to generate an image first
        seed: 0,
        cfg_scale: 1.8,
        motion_bucket_id: 127,
      }),
    });

    if (!response.ok) {
      throw new Error(`Stability AI API error: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      videoUrl: data.video_url,
      duration: 4,
      quality: '720p',
      service: 'Stable Video',
    };
  }

  // Fallback method for when no video generation services are available
  async generateFallbackVideo(exerciseName: string): Promise<VideoGenerationResult> {
    // Return a placeholder video URL
    const videoId = `exercise_${exerciseName.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
    
    return {
      videoUrl: `https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4?exercise=${encodeURIComponent(exerciseName)}&id=${videoId}`,
      duration: 10,
      quality: '720p',
      service: 'Fallback',
    };
  }
}
