import { useState } from 'react';
import { useNavigate } from 'react-router';

import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { paths } from '@/routes/paths';
import { toast } from '@/store/toast.store';

import { CreateOrganizationForm } from './CreateOrganizationForm';

interface CreateOrganizationModalProps {
  open: boolean;
  onClose: () => void;
}

const FORM_ID = 'create-organization-form';

export function CreateOrganizationModal({ open, onClose }: CreateOrganizationModalProps) {
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create organization"
      description="Organizations group your projects, members and billing."
      preventClose={pending}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} loading={pending}>
            Create organization
          </Button>
        </>
      }
    >
      <CreateOrganizationForm
        formId={FORM_ID}
        onPendingChange={setPending}
        onCreated={(organization) => {
          toast.success(`${organization.name} created`, {
            description: 'You are now working in the new organization.',
          });
          onClose();
          void navigate(paths.dashboard);
        }}
      />
    </Modal>
  );
}
