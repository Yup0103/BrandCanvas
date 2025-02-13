import { types, Instance, SnapshotIn, destroy } from 'mobx-state-tree';
import { fabric } from 'fabric';

const CanvasObject = types
  .model('CanvasObject', {
    id: types.identifier,
    type: types.string,
    data: types.frozen(),
  })
  .actions(self => ({
    beforeDestroy() {
      // Cleanup any resources
    }
  }));

const CanvasStore = types
  .model('CanvasStore', {
    objects: types.map(CanvasObject),
    selectedObjectId: types.maybe(types.string),
    history: types.array(types.frozen()),
    currentHistoryIndex: types.optional(types.number, -1),
  })
  .actions(self => ({
    addObject(object: fabric.Object) {
      const id = Math.random().toString(36).substr(2, 9);
      self.objects.set(id, {
        id,
        type: object.type || 'unknown',
        data: object.toJSON(),
      });
    },
    removeObject(id: string) {
      const obj = self.objects.get(id);
      if (obj) {
        destroy(obj);
      }
    },
    setSelectedObject(id: string | undefined) {
      self.selectedObjectId = id;
    },
    addToHistory(state: any) {
      // Remove future history if we're not at the end
      const newHistory = self.history.slice(0, self.currentHistoryIndex + 1);
      newHistory.push(state);
      self.history.replace(newHistory);
      self.currentHistoryIndex += 1;
    },
    undo() {
      if (self.currentHistoryIndex > 0) {
        self.currentHistoryIndex -= 1;
      }
    },
    redo() {
      if (self.currentHistoryIndex < self.history.length - 1) {
        self.currentHistoryIndex += 1;
      }
    },
    cleanup() {
      self.objects.forEach(obj => obj.beforeDestroy());
      self.objects.clear();
      self.selectedObjectId = undefined;
      self.history.clear();
      self.currentHistoryIndex = -1;
    }
  }));

export interface ICanvasStore extends Instance<typeof CanvasStore> {}
export interface ICanvasStoreSnapshotIn extends SnapshotIn<typeof CanvasStore> {}

export const createCanvasStore = () => CanvasStore.create({
  objects: {},
  history: [],
  currentHistoryIndex: -1,
});
