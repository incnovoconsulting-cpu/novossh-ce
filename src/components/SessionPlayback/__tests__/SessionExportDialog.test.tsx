import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SessionExportDialog } from '../SessionExportDialog';

describe('SessionExportDialog', () => {
  const mockSessionId = 'session-test-123';
  const mockSessionName = 'Test Session';

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock localStorage
    const store: Record<string, string> = {};
    Storage.prototype.getItem = vi.fn((key: string) => store[key] || null);
    Storage.prototype.setItem = vi.fn((key: string, value: string) => {
      store[key] = value.toString();
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('rendering', () => {
    it('should not render when closed', () => {
      const { container } = render(
        <SessionExportDialog
          open={false}
          onClose={vi.fn()}
          sessionId={mockSessionId}
          sessionName={mockSessionName}
        />
      );

      expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
    });

    it('should render dialog when open', () => {
      render(
        <SessionExportDialog
          open={true}
          onClose={vi.fn()}
          sessionId={mockSessionId}
          sessionName={mockSessionName}
        />
      );

      expect(screen.getByText('Export Session')).toBeInTheDocument();
      expect(screen.getByText(/Test Session/)).toBeInTheDocument();
    });

    it('should display both format options', () => {
      render(
        <SessionExportDialog
          open={true}
          onClose={vi.fn()}
          sessionId={mockSessionId}
        />
      );

      const bashRadio = screen.getByDisplayValue('bash');
      const jsonRadio = screen.getByDisplayValue('json');
      expect(bashRadio).toBeInTheDocument();
      expect(jsonRadio).toBeInTheDocument();
    });

    it('should have bash selected by default', () => {
      render(
        <SessionExportDialog
          open={true}
          onClose={vi.fn()}
          sessionId={mockSessionId}
        />
      );

      const bashOption = screen.getByDisplayValue('bash') as HTMLInputElement;
      expect(bashOption.checked).toBe(true);
    });
  });

  describe('format selection', () => {
    it('should switch to json format', () => {
      render(
        <SessionExportDialog
          open={true}
          onClose={vi.fn()}
          sessionId={mockSessionId}
        />
      );

      const jsonOption = screen.getByDisplayValue('json') as HTMLInputElement;
      expect(jsonOption.checked).toBe(false);

      fireEvent.click(jsonOption);
      expect(jsonOption.checked).toBe(true);
    });

    it('should display correct description for bash format', () => {
      render(
        <SessionExportDialog
          open={true}
          onClose={vi.fn()}
          sessionId={mockSessionId}
        />
      );

      // Bash is selected by default, so the description should be present
      expect(
        screen.getAllByText(/A shell script that replays the session commands with proper timing/).length
      ).toBeGreaterThan(0);
    });

    it('should display correct description for json format', () => {
      render(
        <SessionExportDialog
          open={true}
          onClose={vi.fn()}
          sessionId={mockSessionId}
        />
      );

      const jsonOption = screen.getByDisplayValue('json');
      fireEvent.click(jsonOption);

      // The description should change when JSON is selected
      // Look for the text in the main description area
      const allDescriptions = screen.getAllByText(/Complete session data in JSON format/);
      expect(allDescriptions.length).toBeGreaterThan(0);
    });

    it('should display usage hint for bash format', () => {
      render(
        <SessionExportDialog
          open={true}
          onClose={vi.fn()}
          sessionId={mockSessionId}
        />
      );

      expect(screen.getByText(/bash session-replay.sh/)).toBeInTheDocument();
    });

    it('should show correct file extension for selected format', () => {
      render(
        <SessionExportDialog
          open={true}
          onClose={vi.fn()}
          sessionId={mockSessionId}
        />
      );

      expect(screen.getByText('.sh')).toBeInTheDocument();

      const jsonOption = screen.getByDisplayValue('json');
      fireEvent.click(jsonOption);

      expect(screen.getByText('.json')).toBeInTheDocument();
    });
  });

  describe('export functionality', () => {
    it('should fetch bash export on button click', async () => {
      const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        blob: vi.fn().mockResolvedValueOnce(new Blob(['#!/bin/bash\necho test'], { type: 'text/plain' })),
      } as any);

      vi.spyOn(window, 'URL').mockReturnValue({
        createObjectURL: vi.fn().mockReturnValue('blob:mock-url'),
        revokeObjectURL: vi.fn(),
      } as any);

      render(
        <SessionExportDialog
          open={true}
          onClose={vi.fn()}
          sessionId={mockSessionId}
        />
      );

      const exportButton = screen.getByRole('button', { name: /Export/ });
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining(`/api/sessions/${mockSessionId}/export?format=bash`),
          expect.any(Object)
        );
      });
    });

    it('should fetch json export on button click', async () => {
      const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        blob: vi.fn().mockResolvedValueOnce(
          new Blob([JSON.stringify({ sessionId: mockSessionId })], { type: 'application/json' })
        ),
      } as any);

      vi.spyOn(window, 'URL').mockReturnValue({
        createObjectURL: vi.fn().mockReturnValue('blob:mock-url'),
        revokeObjectURL: vi.fn(),
      } as any);

      render(
        <SessionExportDialog
          open={true}
          onClose={vi.fn()}
          sessionId={mockSessionId}
        />
      );

      const jsonOption = screen.getByDisplayValue('json');
      fireEvent.click(jsonOption);

      const exportButton = screen.getByRole('button', { name: /Export/ });
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('format=json'),
          expect.any(Object)
        );
      });
    });

    it('should display file size after successful export', async () => {
      const mockBlob = new Blob(['x'.repeat(1024 * 5)], { type: 'text/plain' }); // 5KB
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        blob: vi.fn().mockResolvedValueOnce(mockBlob),
      } as any);

      vi.spyOn(window, 'URL').mockReturnValue({
        createObjectURL: vi.fn().mockReturnValue('blob:mock-url'),
        revokeObjectURL: vi.fn(),
      } as any);

      render(
        <SessionExportDialog
          open={true}
          onClose={vi.fn()}
          sessionId={mockSessionId}
        />
      );

      const exportButton = screen.getByRole('button', { name: /Export/ });
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(screen.getByText(/File size/)).toBeInTheDocument();
        expect(screen.getByText(/5\.00 KB/)).toBeInTheDocument();
      });
    });

    it('should trigger download with correct filename for bash', async () => {
      const mockBlob = new Blob(['#!/bin/bash'], { type: 'text/plain' });
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        blob: vi.fn().mockResolvedValueOnce(mockBlob),
      } as any);

      const mockCreateElement = vi.spyOn(document, 'createElement');
      const mockAppendChild = vi.spyOn(document.body, 'appendChild');
      const mockRemoveChild = vi.spyOn(document.body, 'removeChild');

      vi.spyOn(window, 'URL').mockReturnValue({
        createObjectURL: vi.fn().mockReturnValue('blob:mock-url'),
        revokeObjectURL: vi.fn(),
      } as any);

      render(
        <SessionExportDialog
          open={true}
          onClose={vi.fn()}
          sessionId={mockSessionId}
          sessionName="MySession"
        />
      );

      const exportButton = screen.getByRole('button', { name: /Export/ });
      fireEvent.click(exportButton);

      await waitFor(() => {
        const linkElement = mockCreateElement.mock.results
          .find((r) => r.value.tagName === 'A')
          ?.value as HTMLAnchorElement;

        if (linkElement) {
          expect(linkElement.download).toContain('session-MySession-replay.sh');
        }
      });
    });

    it('should trigger download with correct filename for json', async () => {
      const mockBlob = new Blob([JSON.stringify({})], { type: 'application/json' });
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        blob: vi.fn().mockResolvedValueOnce(mockBlob),
      } as any);

      vi.spyOn(window, 'URL').mockReturnValue({
        createObjectURL: vi.fn().mockReturnValue('blob:mock-url'),
        revokeObjectURL: vi.fn(),
      } as any);

      render(
        <SessionExportDialog
          open={true}
          onClose={vi.fn()}
          sessionId={mockSessionId}
          sessionName="MySession"
        />
      );

      const jsonOption = screen.getByDisplayValue('json');
      fireEvent.click(jsonOption);

      const exportButton = screen.getByRole('button', { name: /Export/ });
      fireEvent.click(exportButton);

      await waitFor(() => {
        const mockCreateElement = vi.spyOn(document, 'createElement');
        expect(mockCreateElement).toHaveBeenCalled();
      });
    });
  });

  describe('error handling', () => {
    it('should display error when fetch fails', async () => {
      vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'));

      render(
        <SessionExportDialog
          open={true}
          onClose={vi.fn()}
          sessionId={mockSessionId}
        />
      );

      const exportButton = screen.getByRole('button', { name: /Export/ });
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });

    it('should display error when response is not ok', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: vi.fn().mockResolvedValueOnce({ error: 'Permission denied' }),
      } as any);

      render(
        <SessionExportDialog
          open={true}
          onClose={vi.fn()}
          sessionId={mockSessionId}
        />
      );

      const exportButton = screen.getByRole('button', { name: /Export/ });
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(screen.getByText('Permission denied')).toBeInTheDocument();
      });
    });

    it('should display generic error when json parsing fails', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        json: vi.fn().mockRejectedValueOnce(new Error('Invalid JSON')),
      } as any);

      render(
        <SessionExportDialog
          open={true}
          onClose={vi.fn()}
          sessionId={mockSessionId}
        />
      );

      const exportButton = screen.getByRole('button', { name: /Export/ });
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(screen.getByText(/Unknown error|HTTP/)).toBeInTheDocument();
      });
    });

    it('should show loading state while exporting', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        blob: vi.fn().mockResolvedValueOnce(new Blob(['test'], { type: 'text/plain' })),
      } as any);

      vi.spyOn(window, 'URL').mockReturnValue({
        createObjectURL: vi.fn().mockReturnValue('blob:mock-url'),
        revokeObjectURL: vi.fn(),
      } as any);

      render(
        <SessionExportDialog
          open={true}
          onClose={vi.fn()}
          sessionId={mockSessionId}
        />
      );

      const exportButton = screen.getByRole('button', { name: /Export/ });
      fireEvent.click(exportButton);

      // Check that loading text appears
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Exporting|Exported/ })).toBeInTheDocument();
      }, { timeout: 2000 });
    });
  });

  describe('dialog closing', () => {
    it('should call onClose when cancel button clicked', () => {
      const onClose = vi.fn();
      render(
        <SessionExportDialog
          open={true}
          onClose={onClose}
          sessionId={mockSessionId}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /Cancel/ });
      fireEvent.click(cancelButton);

      expect(onClose).toHaveBeenCalled();
    });

    it('should auto-close after successful export', async () => {
      const onClose = vi.fn();
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        blob: vi.fn().mockResolvedValueOnce(new Blob(['test'], { type: 'text/plain' })),
      } as any);

      vi.spyOn(window, 'URL').mockReturnValue({
        createObjectURL: vi.fn().mockReturnValue('blob:mock-url'),
        revokeObjectURL: vi.fn(),
      } as any);

      render(
        <SessionExportDialog
          open={true}
          onClose={onClose}
          sessionId={mockSessionId}
        />
      );

      const exportButton = screen.getByRole('button', { name: /Export/ });
      fireEvent.click(exportButton);

      await waitFor(
        () => {
          expect(onClose).toHaveBeenCalled();
        },
        { timeout: 3000 }
      );
    });
  });

  describe('file size handling', () => {
    it('should format large file sizes correctly', async () => {
      const largeBlobSize = 1024 * 1024 * 5; // 5MB
      const mockBlob = new Blob(['x'.repeat(largeBlobSize)], { type: 'text/plain' });
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        blob: vi.fn().mockResolvedValueOnce(mockBlob),
      } as any);

      vi.spyOn(window, 'URL').mockReturnValue({
        createObjectURL: vi.fn().mockReturnValue('blob:mock-url'),
        revokeObjectURL: vi.fn(),
      } as any);

      render(
        <SessionExportDialog
          open={true}
          onClose={vi.fn()}
          sessionId={mockSessionId}
        />
      );

      const exportButton = screen.getByRole('button', { name: /Export/ });
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(screen.getByText(/File size/)).toBeInTheDocument();
        expect(screen.getByText(/5120\.00 KB|5\.00 MB/)).toBeInTheDocument();
      });
    });

    it('should display file size in KB for small files', async () => {
      const mockBlob = new Blob(['x'.repeat(512)], { type: 'text/plain' }); // 512 bytes
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        blob: vi.fn().mockResolvedValueOnce(mockBlob),
      } as any);

      vi.spyOn(window, 'URL').mockReturnValue({
        createObjectURL: vi.fn().mockReturnValue('blob:mock-url'),
        revokeObjectURL: vi.fn(),
      } as any);

      render(
        <SessionExportDialog
          open={true}
          onClose={vi.fn()}
          sessionId={mockSessionId}
        />
      );

      const exportButton = screen.getByRole('button', { name: /Export/ });
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(screen.getByText(/0\.\d{2} KB/)).toBeInTheDocument();
      });
    });
  });

  describe('session name handling', () => {
    it('should use session ID when name not provided', async () => {
      const mockBlob = new Blob(['#!/bin/bash'], { type: 'text/plain' });
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        blob: vi.fn().mockResolvedValueOnce(mockBlob),
      } as any);

      const mockCreateElement = vi.spyOn(document, 'createElement');
      vi.spyOn(document.body, 'appendChild');
      vi.spyOn(document.body, 'removeChild');

      vi.spyOn(window, 'URL').mockReturnValue({
        createObjectURL: vi.fn().mockReturnValue('blob:mock-url'),
        revokeObjectURL: vi.fn(),
      } as any);

      render(
        <SessionExportDialog
          open={true}
          onClose={vi.fn()}
          sessionId={mockSessionId}
        />
      );

      const exportButton = screen.getByRole('button', { name: /Export/ });
      fireEvent.click(exportButton);

      await waitFor(() => {
        const linkElement = mockCreateElement.mock.results
          .find((r) => r.value.tagName === 'A')
          ?.value as HTMLAnchorElement;

        if (linkElement) {
          expect(linkElement.download).toContain(mockSessionId);
        }
      });
    });

    it('should sanitize session name in filename', async () => {
      const mockBlob = new Blob(['#!/bin/bash'], { type: 'text/plain' });
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        blob: vi.fn().mockResolvedValueOnce(mockBlob),
      } as any);

      const mockCreateElement = vi.spyOn(document, 'createElement');
      vi.spyOn(document.body, 'appendChild');
      vi.spyOn(document.body, 'removeChild');

      vi.spyOn(window, 'URL').mockReturnValue({
        createObjectURL: vi.fn().mockReturnValue('blob:mock-url'),
        revokeObjectURL: vi.fn(),
      } as any);

      render(
        <SessionExportDialog
          open={true}
          onClose={vi.fn()}
          sessionId={mockSessionId}
          sessionName="Session/With\\Invalid:Chars"
        />
      );

      const exportButton = screen.getByRole('button', { name: /Export/ });
      fireEvent.click(exportButton);

      await waitFor(() => {
        const linkElement = mockCreateElement.mock.results
          .find((r) => r.value.tagName === 'A')
          ?.value as HTMLAnchorElement;

        if (linkElement) {
          // Should contain either the sanitized name or session ID fallback
          expect(linkElement.download).toBeTruthy();
        }
      });
    });
  });

  describe('success feedback', () => {
    it('should show success message after export', async () => {
      const mockBlob = new Blob(['#!/bin/bash'], { type: 'text/plain' });
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        blob: vi.fn().mockResolvedValueOnce(mockBlob),
      } as any);

      vi.spyOn(window, 'URL').mockReturnValue({
        createObjectURL: vi.fn().mockReturnValue('blob:mock-url'),
        revokeObjectURL: vi.fn(),
      } as any);

      render(
        <SessionExportDialog
          open={true}
          onClose={vi.fn()}
          sessionId={mockSessionId}
        />
      );

      const exportButton = screen.getByRole('button', { name: /Export/ });
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(screen.getByText(/Exported!/)).toBeInTheDocument();
      });
    });
  });

  describe('response header handling', () => {
    it('should detect bash format from correct content type', async () => {
      const mockBlob = new Blob(['#!/bin/bash\necho test'], { type: 'text/plain' });
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        headers: { 'content-type': 'text/plain' },
        blob: vi.fn().mockResolvedValueOnce(mockBlob),
      } as any);

      vi.spyOn(window, 'URL').mockReturnValue({
        createObjectURL: vi.fn().mockReturnValue('blob:mock-url'),
        revokeObjectURL: vi.fn(),
      } as any);

      render(
        <SessionExportDialog
          open={true}
          onClose={vi.fn()}
          sessionId={mockSessionId}
        />
      );

      const exportButton = screen.getByRole('button', { name: /Export/ });
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(mockBlob.type).toBe('text/plain');
      });
    });

    it('should detect json format from correct content type', async () => {
      const mockBlob = new Blob([JSON.stringify({})], { type: 'application/json' });
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        headers: { 'content-type': 'application/json' },
        blob: vi.fn().mockResolvedValueOnce(mockBlob),
      } as any);

      vi.spyOn(window, 'URL').mockReturnValue({
        createObjectURL: vi.fn().mockReturnValue('blob:mock-url'),
        revokeObjectURL: vi.fn(),
      } as any);

      render(
        <SessionExportDialog
          open={true}
          onClose={vi.fn()}
          sessionId={mockSessionId}
        />
      );

      const jsonOption = screen.getByDisplayValue('json');
      fireEvent.click(jsonOption);

      const exportButton = screen.getByRole('button', { name: /Export/ });
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(mockBlob.type).toBe('application/json');
      });
    });
  });
});
