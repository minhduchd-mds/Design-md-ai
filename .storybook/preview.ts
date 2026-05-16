import type { Preview } from '@storybook/react-vite';
import '../ui/styles/global.scss';

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
