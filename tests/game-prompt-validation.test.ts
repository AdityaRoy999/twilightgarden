import {expect,it} from 'vitest';
import {validateGamePrompts} from '../supabase/functions/_shared/gamePromptValidation';
it('accepts empty optional fields in conversational prompts without letting invalid choices through',()=>{
 expect(validateGamePrompts('truth_dare',[{question:'What made you smile today?',options:[],answer:'',type:'Truth'}])).toEqual([{question:'What made you smile today?',options:undefined,answer:undefined,type:'Truth'}]);
 expect(validateGamePrompts('would_you_rather',[{question:'Tea or coffee?',options:[]}])).toHaveLength(0);
 expect(validateGamePrompts('love_trivia',[{question:'Which is a weekday?',options:['Monday','Mars'],answer:'Venus'}])).toHaveLength(0);
});
it('rejects malformed or duplicate prompts and bounds provider output',()=>{
 const valid={question:'Pick a favorite sound.',options:null};
 expect(validateGamePrompts('rapid_fire',[null,{},valid,valid])).toHaveLength(1);
 expect(validateGamePrompts('riddle_me',[{question:'I have keys but no locks.',answer:''}])).toHaveLength(0);
 expect(validateGamePrompts('rapid_fire',Array.from({length:20},(_,i)=>({question:`Original question ${i}`})))).toHaveLength(8);
});
