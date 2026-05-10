import type { Preview } from '@storybook/react-vite';
import '../ui/styles/tokens.css';
import '../ui/styles/global.css';

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'figma-dark',
      values: [
        { name: 'figma-dark', value: '#2c2c2c' },
      ],
    },
    layout: 'padded',
  },
};

export default preview;
