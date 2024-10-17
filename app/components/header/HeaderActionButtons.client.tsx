import { useState } from 'react';
import { useStore } from '@nanostores/react';
import { chatStore } from '~/lib/stores/chat';
import { workbenchStore } from '~/lib/stores/workbench';
import { classNames } from '~/utils/classNames';

// Import the GitHub upload logic
import { downloadProjectZip } from '~/lib/downloadProject';  // Replace with your implementation

interface HeaderActionButtonsProps {}

export function HeaderActionButtons({}: HeaderActionButtonsProps) {
  const showWorkbench = useStore(workbenchStore.showWorkbench);
  const { showChat } = useStore(chatStore);
  const canHideChat = showWorkbench || !showChat;


  // State to handle the upload process
  const [isUploading, setIsUploading] = useState(false);

  const handleDownloadProject = async () => {
    setIsUploading(true);
    try {
      await downloadProjectZip();  // Function to download project as ZIP
    } catch (error) {
      console.error('Error downloading project ZIP:', error);
      alert('Failed to download project ZIP');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex">
      <div className="flex border border-bolt-elements-borderColor rounded-md overflow-hidden">
        <Button
          active={showChat}
          disabled={!canHideChat}
          onClick={() => {
            if (canHideChat) {
              chatStore.setKey('showChat', !showChat);
            }
          }}
        >
          <div className="i-bolt:chat text-sm" />
        </Button>
        <div className="w-[1px] bg-bolt-elements-borderColor" />
        <Button
          active={showWorkbench}
          onClick={() => {
            if (showWorkbench && !showChat) {
              chatStore.setKey('showChat', true);
            }
            workbenchStore.showWorkbench.set(!showWorkbench);
          }}
        >
          <div className="i-ph:code-bold" />
        </Button>
        <div className="w-[1px] bg-bolt-elements-borderColor" />
        <Button
          active={false}
          disabled={isUploading}
          onClick={handleDownloadProject}
        >
          {isUploading ? (
            <div className="i-svg-spinners:90-ring-with-bg text-bolt-elements-loader-progress text-sm">
              Downloading...
            </div>
          ) : (
            <>
              <div className="i-ph:cloud-arrow-down-bold text-sm" />
              <span className="ml-2">Download</span>
            </>
          )}
        </Button>
      </div>

    </div>
  );
}

interface ButtonProps {
  active?: boolean;
  disabled?: boolean;
  children?: any;
  onClick?: VoidFunction;
}

function Button({ active = false, disabled = false, children, onClick }: ButtonProps) {
  return (
    <button
      className={classNames('flex items-center p-1.5', {
        'bg-bolt-elements-item-backgroundDefault hover:bg-bolt-elements-item-backgroundActive text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary':
          !active,
        'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent': active && !disabled,
        'bg-bolt-elements-item-backgroundDefault text-alpha-gray-20 dark:text-alpha-white-20 cursor-not-allowed':
          disabled,
      })}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
