import { useState, useEffect, useCallback } from 'react';
import {
  portForwardingService,
} from '../services/PortForwardingService';
import type {
  PortForward,
  ForwardingTemplate,
  PortForwardingStatus,
} from '../lib/types';

export interface UsePortForwardingReturn {
  forwards: PortForward[];
  templates: ForwardingTemplate[];
  error: string | null;
  loading: boolean;

  createForward: (config: Omit<PortForward, 'id' | 'createdAt' | 'updatedAt'>) => Promise<PortForward>;
  updateForward: (id: string, updates: Partial<PortForward>) => Promise<PortForward>;
  deleteForward: (id: string) => Promise<void>;
  activateForward: (id: string) => Promise<void>;
  deactivateForward: (id: string) => Promise<void>;
  getForwardsForHost: (hostId: string) => PortForward[];
  getStatus: (forwardId: string) => PortForwardingStatus | undefined;
  getActiveForwards: () => PortForward[];
  createFromTemplate: (
    hostId: string,
    templateId: string,
    overrides?: Partial<Omit<PortForward, 'id' | 'createdAt' | 'updatedAt'>>
  ) => Promise<PortForward>;
  testForward: (forwardId: string) => Promise<boolean>;
  saveCustomTemplate: (data: Omit<ForwardingTemplate, 'id'>) => Promise<ForwardingTemplate>;
  deleteCustomTemplate: (id: string) => Promise<void>;
}

export const usePortForwarding = (): UsePortForwardingReturn => {
  const [forwards, setForwards] = useState<PortForward[]>([]);
  const [templates, setTemplates] = useState<ForwardingTemplate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setTemplates(portForwardingService.getTemplates());
  }, []);

  useEffect(() => {
    const handleForwardCreated = (forward: PortForward) => {
      setForwards((prev) => [...prev, forward]);
      setTemplates(portForwardingService.getTemplates());
    };

    const handleForwardUpdated = (forward: PortForward) => {
      setForwards((prev) =>
        prev.map((f) => (f.id === forward.id ? forward : f))
      );
    };

    const handleForwardDeleted = (forward: PortForward) => {
      setForwards((prev) => prev.filter((f) => f.id !== forward.id));
    };

    const handleForwardActivated = (forward: PortForward) => {
      setForwards((prev) =>
        prev.map((f) => (f.id === forward.id ? { ...f, active: true } : f))
      );
    };

    const handleForwardDeactivated = (forward: PortForward) => {
      setForwards((prev) =>
        prev.map((f) => (f.id === forward.id ? { ...f, active: false } : f))
      );
    };

    const handleForwardError = (payload: { id: string; error: string }) => {
      setError(payload.error);
    };

    const handleTemplateSaved = () => {
      setTemplates(portForwardingService.getTemplates());
    };

    const handleTemplateDeleted = () => {
      setTemplates(portForwardingService.getTemplates());
    };

    portForwardingService.on('forwardCreated', handleForwardCreated);
    portForwardingService.on('forwardUpdated', handleForwardUpdated);
    portForwardingService.on('forwardDeleted', handleForwardDeleted);
    portForwardingService.on('forwardActivated', handleForwardActivated);
    portForwardingService.on('forwardDeactivated', handleForwardDeactivated);
    portForwardingService.on('forwardError', handleForwardError);
    portForwardingService.on('templateSaved', handleTemplateSaved);
    portForwardingService.on('templateDeleted', handleTemplateDeleted);

    setForwards(portForwardingService.getAllForwards());

    return () => {
      portForwardingService.removeListener('forwardCreated', handleForwardCreated);
      portForwardingService.removeListener('forwardUpdated', handleForwardUpdated);
      portForwardingService.removeListener('forwardDeleted', handleForwardDeleted);
      portForwardingService.removeListener('forwardActivated', handleForwardActivated);
      portForwardingService.removeListener('forwardDeactivated', handleForwardDeactivated);
      portForwardingService.removeListener('forwardError', handleForwardError);
      portForwardingService.removeListener('templateSaved', handleTemplateSaved);
      portForwardingService.removeListener('templateDeleted', handleTemplateDeleted);
    };
  }, []);

  const createForward = useCallback(
    async (config: Omit<PortForward, 'id' | 'createdAt' | 'updatedAt'>) => {
      try {
        setLoading(true);
        setError(null);
        return await portForwardingService.createForward(config);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Create failed';
        setError(errorMsg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const updateForward = useCallback(
    async (id: string, updates: Partial<PortForward>) => {
      try {
        setLoading(true);
        setError(null);
        return await portForwardingService.updateForward(id, updates);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Update failed';
        setError(errorMsg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const deleteForward = useCallback(async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      await portForwardingService.deleteForward(id);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Delete failed';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const activateForward = useCallback(async (id: string) => {
    try {
      setError(null);
      await portForwardingService.activateForward(id);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Activation failed';
      setError(errorMsg);
      throw err;
    }
  }, []);

  const deactivateForward = useCallback(async (id: string) => {
    try {
      setError(null);
      await portForwardingService.deactivateForward(id);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Deactivation failed';
      setError(errorMsg);
      throw err;
    }
  }, []);

  const getForwardsForHost = useCallback(
    (hostId: string) => portForwardingService.getForwardsForHost(hostId),
    []
  );

  const getStatus = useCallback(
    (forwardId: string) => portForwardingService.getStatus(forwardId),
    []
  );

  const getActiveForwards = useCallback(
    () => portForwardingService.getActiveForwards(),
    []
  );

  const createFromTemplate = useCallback(
    async (
      hostId: string,
      templateId: string,
      overrides?: Partial<Omit<PortForward, 'id' | 'createdAt' | 'updatedAt'>>
    ) => {
      try {
        setLoading(true);
        setError(null);
        return await portForwardingService.createFromTemplate(hostId, templateId, overrides);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Creation failed';
        setError(errorMsg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const testForward = useCallback(async (forwardId: string) => {
    try {
      setError(null);
      return await portForwardingService.testForward(forwardId);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Test failed';
      setError(errorMsg);
      return false;
    }
  }, []);

  const saveCustomTemplate = useCallback(
    async (data: Omit<ForwardingTemplate, 'id'>) => {
      try {
        setLoading(true);
        setError(null);
        return await portForwardingService.saveCustomTemplate(data);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Save template failed';
        setError(errorMsg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const deleteCustomTemplate = useCallback(async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      await portForwardingService.deleteCustomTemplate(id);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Delete template failed';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    forwards,
    templates,
    error,
    loading,
    createForward,
    updateForward,
    deleteForward,
    activateForward,
    deactivateForward,
    getForwardsForHost,
    getStatus,
    getActiveForwards,
    createFromTemplate,
    testForward,
    saveCustomTemplate,
    deleteCustomTemplate,
  };
};
